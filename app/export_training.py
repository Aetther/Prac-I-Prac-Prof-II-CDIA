"""
Actividad 2 (parte A): exporta las decisiones humanas a un CSV de entrenamiento.

Junta dos fuentes de ejemplos verificados por una persona:
1. Categorizaciones manuales de la base (is_automatic = False)
2. Categorizaciones automáticas confirmadas en la revisión de precisión
   (data/precision_review.csv, is_correct = "1")

Genera data/training_data.csv y muestra cuántos ejemplos hay por categoría.
El mismo archivo sirve para restaurar las decisiones en una base nueva
(app/restore_decisions.py).

Uso:
    poetry run python -m app.export_training
"""
import csv
from collections import Counter
from pathlib import Path
from typing import Any

from app.categories import get_category_names
from app.database import SessionLocal
from app.models import Categorization, Question
from app.review_automatic import label, load_reviews

OUTPUT_FILE = Path("data") / "training_data.csv"
FIELDS = ["question_id", "question", "answer", "category_name", "confidence_score", "source"]

# SetFit necesita, como mínimo, alrededor de 8 ejemplos por categoría
MIN_PER_CATEGORY = 8


def main() -> None:
    # {question_id: (categoría confirmada, score de la IA)}
    confirmed = {
        int(r["question_id"]): (r["human_category"], r["confidence_score"])
        for r in load_reviews()
        if r["is_correct"] == "1"
    }

    db = SessionLocal()
    try:
        manual: list[Any] = (
            db.query(
                Question.id,
                Question.question,
                Question.answer,
                Categorization.category_name,
                Categorization.confidence_score,
            )
            .join(Categorization, Categorization.question_id == Question.id)
            .filter(Categorization.is_automatic.is_(False))
            .all()
        )
        # Los textos se toman de la base (y no del CSV de revisión)
        # para usar la versión ya reparada con ftfy
        confirmed_questions: list[Any] = (
            db.query(Question.id, Question.question, Question.answer)
            .filter(Question.id.in_(confirmed.keys()))
            .all()
            if confirmed
            else []
        )
    finally:
        db.close()

    # Un diccionario por question_id evita ejemplos duplicados
    examples: dict[int, dict[str, Any]] = {}
    for row in manual:
        examples[row.id] = {
            "question_id": row.id,
            "question": row.question,
            "answer": row.answer,
            "category_name": row.category_name,
            "confidence_score": f"{row.confidence_score:.4f}",
            "source": "manual",
        }
    for row in confirmed_questions:
        category_name, confidence = confirmed[row.id]
        # setdefault: si ya estaba como manual, se conserva esa versión
        examples.setdefault(
            row.id,
            {
                "question_id": row.id,
                "question": row.question,
                "answer": row.answer,
                "category_name": category_name,
                "confidence_score": confidence,
                "source": "automatica_verificada",
            },
        )

    rows = sorted(examples.values(), key=lambda e: e["question_id"])

    OUTPUT_FILE.parent.mkdir(exist_ok=True)
    with OUTPUT_FILE.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)

    by_category = Counter(r["category_name"] for r in rows)
    by_source = Counter(r["source"] for r in rows)

    print(f"Ejemplos exportados: {len(rows)} → {OUTPUT_FILE}")
    print(f"  Manuales:                {by_source['manual']}")
    print(f"  Automáticos verificados: {by_source['automatica_verificada']}")
    print()
    print(f"{'Categoría':<16} | {'Ejemplos':>8} | Estado")
    print("-" * 48)
    for name in get_category_names():
        count = by_category[name]
        status = "OK" if count >= MIN_PER_CATEGORY else f"faltan {MIN_PER_CATEGORY - count}"
        print(f"{label(name):<16} | {count:>8} | {status}")


if __name__ == "__main__":
    main()