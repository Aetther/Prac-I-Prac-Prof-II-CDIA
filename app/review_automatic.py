"""
Actividad 5: precisión real de la categorización automática.

Muestra al azar categorizaciones hechas automáticamente por la IA y le pide
a una persona que indique si son correctas. Si no lo son, se corrigen en la
base. Cada revisión se registra en data/precision_review.csv y al final se
calcula la precisión con su intervalo de confianza.

Uso:
    poetry run python -m app.review_automatic --sample 60
    poetry run python -m app.review_automatic --sample 15 --category arte
    poetry run python -m app.review_automatic --sample 0   (solo muestra el reporte)
"""
import argparse
import csv
import math
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import func

from app.categories import CATEGORIES, find_category_by_name, get_category_names
from app.database import SessionLocal
from app.human_review import ask_human_for_category, confirm_ai_suggestion
from app.models import Categorization, Question

REVIEW_FILE = Path("data") / "precision_review.csv"
FIELDS = [
    "categorization_id",
    "question_id",
    "question",
    "answer",
    "ai_category",
    "confidence_score",
    "human_category",
    "is_correct",
    "reviewed_at",
]
LINE = "═" * 64


def label(name: str) -> str:
    category = find_category_by_name(name)
    return category["label"] if category else name


def load_reviews() -> list[dict[str, str]]:
    """Lee todas las revisiones guardadas en el CSV."""
    if not REVIEW_FILE.exists():
        return []
    with REVIEW_FILE.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def append_review(row: dict[str, Any]) -> None:
    """Agrega una revisión al CSV (y escribe el encabezado si el archivo es nuevo)."""
    REVIEW_FILE.parent.mkdir(exist_ok=True)
    is_new = not REVIEW_FILE.exists()
    with REVIEW_FILE.open("a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        if is_new:
            writer.writeheader()
        writer.writerow(row)


def get_sample(db, size: int, exclude_ids: set[int], category: str | None = None) -> list[Any]:
    """Categorizaciones automáticas al azar que todavía no fueron revisadas."""
    query = (
        db.query(Categorization, Question)
        .join(Question, Question.id == Categorization.question_id)
        .filter(Categorization.is_automatic.is_(True))
    )
    if category:
        query = query.filter(Categorization.category_name == category)
    if exclude_ids:
        query = query.filter(~Categorization.id.in_(exclude_ids))
    return query.order_by(func.random()).limit(size).all()


def review(size: int, category: str | None = None) -> None:
    # Con --sample 0 solo se muestra el reporte de las revisiones ya hechas
    if size <= 0:
        print_report(load_reviews())
        return

    reviewed_ids = {int(r["categorization_id"]) for r in load_reviews()}
    db = SessionLocal()
    try:
        sample = get_sample(db, size, reviewed_ids, category)
        if not sample:
            print("No quedan categorizaciones automáticas sin revisar.")
            return

        for index, (categorization, question) in enumerate(sample, start=1):
            ai_category = categorization.category_name
            confidence = categorization.confidence_score

            print()
            print(LINE)
            print(f"[{index}/{len(sample)}] REVISIÓN DE CATEGORIZACIÓN AUTOMÁTICA")
            print(LINE)
            print(f"Pregunta:  {question.question}")
            print(f"Respuesta: {question.answer}")
            print()
            print(f"Categoría asignada por la IA: {label(ai_category)} (confianza: {confidence:.0%})")
            print(LINE)

            if confirm_ai_suggestion(ai_category, confidence):
                human_category, is_correct = ai_category, "1"
            else:
                chosen = ask_human_for_category(CATEGORIES)
                if chosen is None:
                    # Ninguna categoría corresponde: no cuenta para la precisión
                    human_category, is_correct = "", ""
                else:
                    human_category = chosen
                    is_correct = "1" if chosen == ai_category else "0"
                    if chosen != ai_category:
                        # Se corrige en la base: ahora la decisión es humana
                        db.query(Categorization).filter(
                            Categorization.id == categorization.id
                        ).update({"category_name": chosen, "is_automatic": False})
                        db.commit()

            append_review(
                {
                    "categorization_id": categorization.id,
                    "question_id": question.id,
                    "question": question.question,
                    "answer": question.answer,
                    "ai_category": ai_category,
                    "confidence_score": f"{confidence:.4f}",
                    "human_category": human_category,
                    "is_correct": is_correct,
                    "reviewed_at": datetime.now(timezone.utc).isoformat(),
                }
            )
    except KeyboardInterrupt:
        print("\n\nInterrumpido. Las revisiones hechas quedaron guardadas.")
    finally:
        db.close()

    print_report(load_reviews())


def wilson_interval(successes: int, n: int, z: float = 1.96) -> tuple[float, float]:
    """
    Intervalo de confianza de Wilson para una proporción.
    A diferencia de la aproximación normal, funciona bien cerca de 0% y 100%.
    """
    p = successes / n
    denominator = 1 + z**2 / n
    center = (p + z**2 / (2 * n)) / denominator
    half_width = z * math.sqrt(p * (1 - p) / n + z**2 / (4 * n**2)) / denominator
    return max(0.0, center - half_width), min(1.0, center + half_width)


def print_report(reviews: list[dict[str, str]]) -> None:
    """Precisión acumulada de todas las revisiones del CSV."""
    valid = [r for r in reviews if r["is_correct"] in ("0", "1")]
    not_applicable = len(reviews) - len(valid)

    print()
    print(LINE)
    print("PRECISIÓN DE LA CATEGORIZACIÓN AUTOMÁTICA (revisión humana)")
    print(LINE)
    if not valid:
        print("Todavía no hay revisiones válidas.")
        return

    n = len(valid)
    correct = sum(r["is_correct"] == "1" for r in valid)
    precision = correct / n
    # Intervalo de confianza del 95% (Wilson): rango donde está la precisión real
    low, high = wilson_interval(correct, n)

    print(f"Revisadas:     {len(reviews)} ({not_applicable} sin categoría aplicable)")
    print(f"Correctas:     {correct}/{n}")
    print(f"Precisión:     {precision:.1%} (IC 95%: {low:.1%} a {high:.1%})")
    print()
    print(f"{'Categoría IA':<16} | {'Revisadas':>9} | {'Correctas':>9} | {'Precisión':>9}")
    print("-" * 64)

    by_category: dict[str, list[dict[str, str]]] = defaultdict(list)
    for r in valid:
        by_category[r["ai_category"]].append(r)
    for name, rows in sorted(by_category.items()):
        hits = sum(r["is_correct"] == "1" for r in rows)
        print(f"{label(name):<16} | {len(rows):>9} | {hits:>9} | {hits / len(rows):>9.0%}")
    print(LINE)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Revisión humana de categorizaciones automáticas")
    parser.add_argument("--sample", type=int, default=60,
                        help="Cantidad de categorizaciones a revisar (0 = solo mostrar el reporte)")
    parser.add_argument("--category", choices=get_category_names(), default=None,
                        help="Revisar solo categorizaciones de esta categoría")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    review(args.sample, args.category)