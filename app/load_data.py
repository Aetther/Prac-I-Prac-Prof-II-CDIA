"""
Descarga el dataset de trivia desde Hugging Face y lo carga en la base.

1. Descarga kth8/OpenTriviaQA en formato Parquet
2. Repara errores de codificación del texto con ftfy
3. Se queda con las preguntas de 4 opciones (correcta + 3 incorrectas)
4. Agrupa las categorías originales en las 6 de Preguntados

ATENCIÓN: reemplaza las preguntas existentes y borra sus categorizaciones.
Las decisiones humanas se pueden restaurar después con:
    poetry run python -m app.restore_decisions

Uso:
    poetry run python -m app.load_data
"""
import os
import tempfile

import pandas as pd
import requests
from ftfy import fix_text

from app.database import SessionLocal, engine
from app.models import Base, Categorization, Question

DATASET_URL = (
    "https://huggingface.co/datasets/kth8/OpenTriviaQA/resolve/"
    "refs%2Fconvert%2Fparquet/default/train/0000.parquet"
)

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


def download_parquet(url: str) -> str:
    print(f"Descargando {url}...")
    r = requests.get(url, timeout=60)
    r.raise_for_status()
    with tempfile.NamedTemporaryFile(delete=False, suffix=".parquet") as tmp:
        tmp.write(r.content)
        return tmp.name


def build_rows(df: pd.DataFrame) -> list[dict]:
    """Convierte el DataFrame en filas listas para insertar,
    descartando las que no cumplen el formato."""
    rows = []
    for record in df.to_dict(orient="records"):
        category = CATEGORY_MAP.get(str(record["category"]))
        if category is None:
            continue

        answer = clean(record["answer"])
        # choices viene como array de numpy: lo pasamos a lista de strings limpios
        choices = [clean(c) for c in list(record["choices"])]

        # Opciones incorrectas = todas menos la correcta, sin repetidos
        wrong = list(dict.fromkeys(c for c in choices if c and c != answer))

        # Solo preguntas con la correcta entre las opciones y exactamente 3 incorrectas
        # (esto descarta las de Verdadero/Falso)
        if answer not in choices or len(wrong) != 3:
            continue

        rows.append({
            "question": clean(record["question"]),
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

    parquet_path = download_parquet(DATASET_URL)
    try:
        df = pd.read_parquet(parquet_path)
    finally:
        os.unlink(parquet_path)

    print(f"Filas en el dataset: {len(df)}")
    rows = build_rows(df)
    print(f"Filas válidas (4 opciones y categoría mapeada): {len(rows)}")

    session = SessionLocal()
    try:
        # Las categorizaciones apuntan a las preguntas (clave foránea),
        # así que hay que borrarlas antes de reemplazar las preguntas.
        deleted = session.query(Categorization).delete()
        session.query(Question).delete()
        session.bulk_insert_mappings(Question, rows)
        session.commit()
        print(f"Se insertaron {len(rows)} preguntas correctamente.")
        if deleted:
            print(
                f"Se borraron {deleted} categorizaciones anteriores. Para recuperar "
                "las decisiones humanas: poetry run python -m app.restore_decisions"
            )
    except Exception as e:
        session.rollback()
        print(f"Error: {e}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    load_questions()