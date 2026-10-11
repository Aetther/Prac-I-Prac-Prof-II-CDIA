"""
Restaura en la base las decisiones humanas guardadas en data/training_data.csv.

Sirve para que quien clone el repositorio recupere las revisiones humanas
sin tener que repetirlas. Flujo típico en una base nueva:

    poetry run python -m app.load_data
    poetry run python -m app.restore_decisions
    poetry run python -m app.categorize --auto-only

Las preguntas se identifican por su texto (pregunta + respuesta), no por
su id: los ids cambian cada vez que se recarga el dataset.

Es seguro ejecutarlo más de una vez: lo que ya está restaurado no se duplica.

Uso:
    poetry run python -m app.restore_decisions
"""
import csv
from typing import Any

from app.database import SessionLocal
from app.export_training import OUTPUT_FILE as TRAINING_FILE
from app.models import Categorization, Question


def main() -> None:
    if not TRAINING_FILE.exists():
        print(f"No existe {TRAINING_FILE}: no hay decisiones para restaurar.")
        return

    with TRAINING_FILE.open(newline="", encoding="utf-8") as f:
        decisions = list(csv.DictReader(f))

    created = updated = unchanged = not_found = 0
    db = SessionLocal()
    try:
        questions: list[Any] = db.query(Question.id, Question.question, Question.answer).all()
        id_by_text = {(q.question, q.answer): q.id for q in questions}
        categorizations: list[Any] = db.query(Categorization).all()
        existing: dict[int, Any] = {c.question_id: c for c in categorizations}

        for decision in decisions:
            question_id = id_by_text.get((decision["question"], decision["answer"]))
            if question_id is None:
                not_found += 1
                continue

            category_name = decision["category_name"]
            # Las automáticas verificadas fueron decisión de la IA, confirmada
            # por una persona: se restauran como automáticas, igual que antes.
            is_automatic = decision["source"] == "automatica_verificada"
            confidence = float(decision.get("confidence_score") or 0.0)

            current = existing.get(question_id)
            if current is None:
                db.add(
                    Categorization(
                        question_id=question_id,
                        category_name=category_name,
                        confidence_score=confidence,
                        is_automatic=is_automatic,
                    )
                )
                created += 1
            elif current.category_name == category_name and current.is_automatic == is_automatic:
                unchanged += 1
            else:
                db.query(Categorization).filter(Categorization.id == current.id).update(
                    {"category_name": category_name, "is_automatic": is_automatic}
                )
                updated += 1

        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    print(f"Decisiones en el CSV:        {len(decisions)}")
    print(f"  Restauradas (nuevas):      {created}")
    print(f"  Actualizadas:              {updated}")
    print(f"  Ya estaban:                {unchanged}")
    if not_found:
        print(f"  Pregunta no encontrada:    {not_found}")


if __name__ == "__main__":
    main()