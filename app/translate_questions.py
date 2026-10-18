"""
Traducción masiva de las preguntas al español.

1. Agrega las columnas de traducción a la tabla si todavía no existen
2. Busca las preguntas sin traducir (is_translated = false)
3. Las traduce en tandas con el modelo de Helsinki-NLP (en GPU si hay):
   - la pregunta, sola
   - las 4 opciones, cada una con su pregunta como contexto
4. Guarda la traducción y la marca como traducida. El inglés no se toca.

Si en una pregunta dos opciones quedan iguales al traducirlas, no se guarda:
con opciones repetidas no se puede jugar, así que queda en inglés.

Se puede cortar con Ctrl+C y retomar: cada tanda se guarda al terminarla.

Después de traducir, correr app.apply_glossary --apply para aplicar las
correcciones manuales de data/translation_corrections.csv.

Uso:
    poetry run python -m app.translate_questions --limit 200
    poetry run python -m app.translate_questions
"""
import argparse
import time
from typing import Any

from tqdm import tqdm

from app.database import SessionLocal, engine
from app.glossary import options_are_distinct
from app.models import Base, Question, ensure_translation_columns
from app.translator import Translator

# Cantidad de preguntas que se traducen juntas antes de guardarlas
CHUNK_SIZE = 256


def translate_questions(limit: int | None, batch_size: int) -> None:
    Base.metadata.create_all(bind=engine)
    added = ensure_translation_columns(engine)
    if added:
        print(f"Columnas agregadas a la tabla questions: {', '.join(added)}")

    db = SessionLocal()
    translated = skipped = 0
    translator: Translator | None = None
    start_time = time.perf_counter()
    try:
        query = (
            db.query(Question)
            .filter(Question.is_translated.is_(False))
            .order_by(Question.id)
        )
        if limit:
            query = query.limit(limit)
        rows: list[Any] = query.all()

        if not rows:
            print("No hay preguntas sin traducir.")
            return
        print(f"Preguntas a traducir: {len(rows)}")

        translator = Translator()

        with tqdm(total=len(rows), desc="Traduciendo", unit="preg") as bar:
            for start in range(0, len(rows), CHUNK_SIZE):
                chunk = rows[start:start + CHUNK_SIZE]
                questions = [q.question for q in chunk]
                options = [[q.answer, q.wrong_1, q.wrong_2, q.wrong_3] for q in chunk]

                questions_es = translator.translate_batch(questions, batch_size)
                options_es = translator.translate_options_batch(
                    questions, options, batch_size
                )

                for q, question_es, opts_es in zip(chunk, questions_es, options_es):
                    if not question_es or not options_are_distinct(opts_es):
                        skipped += 1
                        continue
                    q.question_es = question_es
                    q.answer_es, q.wrong_1_es, q.wrong_2_es, q.wrong_3_es = opts_es
                    q.is_translated = True
                    q.translation_model = translator.model_name
                    translated += 1

                db.commit()  # cada tanda queda guardada
                bar.update(len(chunk))

    except KeyboardInterrupt:
        db.rollback()  # la tanda a medio traducir se descarta; las anteriores ya están guardadas
        print("\nInterrumpido. Las tandas terminadas quedaron guardadas.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    elapsed = time.perf_counter() - start_time
    print()
    print("=" * 50)
    print(f"Traducidas:                       {translated}")
    print(f"Sin traducir (opciones repetidas): {skipped}")
    print(f"Tiempo:                           {elapsed:.0f} s")
    if translator is not None and translator.memory_splits:
        print(
            f"Lotes divididos por falta de memoria en la GPU: {translator.memory_splits}"
            " (si son muchos, probar con un --batch-size menor)"
        )
    print("=" * 50)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Traduce las preguntas al español con IA")
    parser.add_argument("--limit", type=int, default=None,
                        help="Cantidad máxima de preguntas a traducir")
    parser.add_argument("--batch-size", type=int, default=32,
                        help="Textos que el modelo traduce a la vez (más = más rápido en GPU)")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    translate_questions(args.limit, args.batch_size)