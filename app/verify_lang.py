"""
Muestra algunas preguntas en inglés y en español, lado a lado, y cuántas
están traducidas. Sirve para ver de un vistazo en qué idioma está la base.

Es el paso 2 de la consigna de traducción (EXERCISE_AI_TRANSLATION.md),
adaptado a este proyecto: además del inglés, muestra la traducción.

Uso:
    poetry run python -m app.verify_lang
    poetry run python -m app.verify_lang --limit 10
"""
import argparse
from typing import Any

from sqlalchemy import func

from app.database import SessionLocal
from app.models import Question


def verify_questions(limit: int) -> None:
    db = SessionLocal()
    try:
        total = db.query(func.count(Question.id)).scalar() or 0
        translated = (
            db.query(func.count(Question.id))
            .filter(Question.is_translated.is_(True))
            .scalar()
            or 0
        )
        sample: list[Any] = db.query(Question).order_by(Question.id).limit(limit).all()
    finally:
        db.close()

    print(f"--- Muestra de {len(sample)} preguntas ---")
    for q in sample:
        print(f"ID: {q.id}  (traducida: {'sí' if q.is_translated else 'no'})")
        print(f"  EN: {q.question}")
        print(f"      Respuesta: {q.answer}")
        if q.is_translated:
            print(f"  ES: {q.question_es}")
            print(f"      Respuesta: {q.answer_es}")
        print("-" * 60)

    percentage = translated / total * 100 if total else 0.0
    print(f"Traducidas al español: {translated} de {total} ({percentage:.1f}%)")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Muestra el idioma de las preguntas")
    parser.add_argument("--limit", type=int, default=5,
                        help="Cantidad de preguntas a mostrar")
    return parser.parse_args()


if __name__ == "__main__":
    verify_questions(parse_args().limit)