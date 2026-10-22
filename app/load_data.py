"""
Descarga el dataset de trivia desde Hugging Face y lo carga en la base.

1. Descarga kth8/OpenTriviaQA en formato Parquet, en una versión fija,
   y verifica que el archivo sea exactamente el esperado (hash SHA-256)
2. Repara errores de codificación del texto con ftfy
3. Se queda con las preguntas de 4 opciones (correcta + 3 incorrectas)
4. Agrupa las categorías originales en las 6 de Preguntados

ATENCIÓN: reemplaza las preguntas existentes y borra sus categorizaciones,
traducciones e historial de ediciones. Después hay que:
    poetry run python -m app.restore_decisions        (decisiones humanas)
    poetry run python -m app.categorize --auto-only   (categorización con IA)
    poetry run python -m app.translate_questions      (traducción al español)

Uso:
    poetry run python -m app.load_data
"""
import hashlib
import os
import tempfile

import pandas as pd
import requests
from ftfy import fix_text

from app.database import SessionLocal, engine
from app.models import (
    Base,
    Categorization,
    Question,
    QuestionEdit,
    ensure_question_columns,
)

# Versión fija del dataset: un commit no cambia nunca, a diferencia de la rama
# refs/convert/parquet, que Hugging Face regenera sola. Así todos obtienen
# exactamente las mismas preguntas.
DATASET_REVISION = "e7722ebb15ac58f252aa9f8fae8c8efb95e8446d"
DATASET_URL = (
    "https://huggingface.co/datasets/kth8/OpenTriviaQA/resolve/"
    f"{DATASET_REVISION}/default/train/0000.parquet"
)
# "Huella digital" del archivo esperado. Si el archivo descargado no coincide,
# la carga se detiene en lugar de cargar datos distintos o alterados.
DATASET_SHA256 = "daef760658d2b3f39be17a769d4de499282bd7f565af26eb650a9b58009d3b59"

# Categorías del dataset -> categorías estilo Preguntados.
# Las que no figuran acá se descartan.
CATEGORY_MAP = {
    "geography": "Geografía",
    "world": "Geografía",
    "history": "Historia",
    "science-technology": "Ciencia",
    "animals": "Ciencia",
    "literature": "Arte",
    "humanities": "Arte",
    "movies": "Entretenimiento",
    "music": "Entretenimiento",
    "television": "Entretenimiento",
    "video-games": "Entretenimiento",
    "sports": "Deportes",
}


def clean(value) -> str:
    """Repara errores de codificación (ej. 'Queenâ\\x80\\x99s') y quita espacios sobrantes."""
    return fix_text(str(value)).strip()


def verify_sha256(content: bytes, expected: str) -> None:
    """Lanza un error si el hash SHA-256 del contenido no es el esperado."""
    actual = hashlib.sha256(content).hexdigest()
    if actual != expected:
        raise ValueError(
            "El archivo descargado no coincide con la versión esperada "
            f"(sha256 esperado {expected}, obtenido {actual}). No se cargó nada."
        )


def download_parquet(url: str, expected_sha256: str) -> str:
    print(f"Descargando {url}...")
    r = requests.get(url, timeout=60)
    r.raise_for_status()
    verify_sha256(r.content, expected_sha256)
    print("Archivo verificado (sha256 correcto).")
    with tempfile.NamedTemporaryFile(delete=False, suffix=".parquet") as tmp:
        tmp.write(r.content)
        return tmp.name


def build_rows(df: pd.DataFrame) -> list[dict]:
    """Convierte el DataFrame en filas listas para insertar,
    descartando las que no cumplen el formato."""
    rows = []
    seen: set[tuple[str, str]] = set()
    for record in df.to_dict(orient="records"):
        category = CATEGORY_MAP.get(str(record["category"]))
        if category is None:
            continue

        question = clean(record["question"])
        answer = clean(record["answer"])
        # choices viene como array de numpy: lo pasamos a lista de strings limpios
        choices = [clean(c) for c in list(record["choices"])]

        # Opciones incorrectas = todas menos la correcta, sin repetidos
        wrong = list(dict.fromkeys(c for c in choices if c and c != answer))

        # Solo preguntas con la correcta entre las opciones y exactamente 3 incorrectas
        # (esto descarta las de Verdadero/Falso)
        if answer not in choices or len(wrong) != 3:
            continue

        # Verdadero/Falso "disfrazadas" de 4 opciones: las otras opciones
        # suelen ser fragmentos de texto cortados, no respuestas reales
        if any(c.lower() in ("true", "false") for c in choices):
            continue

        # La misma pregunta puede aparecer en varias categorías del dataset:
        # se conserva solo la primera aparición
        key = (question, answer)
        if key in seen:
            continue
        seen.add(key)

        rows.append({
            "question": question,
            "answer": answer,
            "wrong_1": wrong[0],
            "wrong_2": wrong[1],
            "wrong_3": wrong[2],
            "category": category,
            "source": "kth8/OpenTriviaQA",
        })
    return rows


def load_questions():
    Base.metadata.create_all(bind=engine)
    # Una base creada antes de la traducción o de la administración
    # no tiene esas columnas
    ensure_question_columns(engine)

    parquet_path = download_parquet(DATASET_URL, DATASET_SHA256)
    try:
        df = pd.read_parquet(parquet_path)
    finally:
        os.unlink(parquet_path)

    print(f"Filas en el dataset: {len(df)}")
    rows = build_rows(df)
    print(f"Filas válidas (4 opciones y categoría mapeada): {len(rows)}")

    session = SessionLocal()
    try:
        # Las categorizaciones y las ediciones apuntan a las preguntas (clave
        # foránea), así que hay que borrarlas antes de reemplazar las preguntas.
        deleted = session.query(Categorization).delete()
        edits = session.query(QuestionEdit).delete()
        session.query(Question).delete()
        session.bulk_insert_mappings(Question, rows)
        session.commit()
        print(f"Se insertaron {len(rows)} preguntas correctamente.")
        if deleted:
            print(
                f"Se borraron {deleted} categorizaciones anteriores. Para recuperar "
                "las decisiones humanas: poetry run python -m app.restore_decisions"
            )
        if edits:
            print(f"Se borró el historial de {edits} ediciones hechas por el admin.")
        print(
            "Las preguntas quedaron sin traducir. Para traducirlas: "
            "poetry run python -m app.translate_questions --batch-size 64"
        )
    except Exception as e:
        session.rollback()
        print(f"Error: {e}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    load_questions()