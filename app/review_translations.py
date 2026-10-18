"""
Calidad real de la traducción automática (revisión humana).

Muestra al azar preguntas traducidas, con el inglés original al lado, y le
pide a una persona que califique la traducción completa (pregunta y opciones):

  b = bien     correcta y natural
  m = menor    se entiende y se puede jugar, pero tiene un detalle
               (una palabra rara, un nombre traducido de más, estilo)
  e = error    cambia el sentido o no se puede jugar bien
  s = saltear  no se califica (no cuenta para el reporte)

Si hay un detalle o un error, se puede anotar cuál: esas notas sirven para
armar el glosario de correcciones. Cada revisión se guarda en
data/translation_review.csv, así se puede cortar con Ctrl+C y seguir después.
La muestra es reproducible: la misma semilla elige siempre las mismas preguntas.

Uso:
    poetry run python -m app.review_translations --sample 50
    poetry run python -m app.review_translations --sample 0   (solo muestra el reporte)
"""
import argparse
import csv
import random
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.database import SessionLocal
from app.models import Question
from app.review_automatic import wilson_interval

REVIEW_FILE = Path("data") / "translation_review.csv"
FIELDS = [
    "question_id",
    "question",
    "question_es",
    "options",
    "options_es",
    "rating",
    "note",
    "reviewed_at",
]
RATINGS = {"b": "bien", "m": "menor", "e": "error"}
LINE = "═" * 64


def parse_rating(text: str) -> str | None:
    """
    Convierte lo que escribió la persona en una calificación:
    "bien", "menor", "error", "" (saltear) o None (no se entendió).
    """
    key = text.strip().lower()[:1]
    if key == "s":
        return ""
    return RATINGS.get(key)


def ask_rating() -> str:
    while True:
        rating = parse_rating(input("Calificación [b]ien / [m]enor / [e]rror / [s]altear: "))
        if rating is not None:
            return rating
        print("Opción no válida.")


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


def choose_sample(ids: list[int], size: int, exclude: set[int], seed: int) -> list[int]:
    """
    Elige al azar `size` ids que todavía no fueron revisados.
    Con la misma semilla, el orden es siempre el mismo: si se corta y se
    retoma, se sigue con las siguientes de la misma muestra.
    """
    shuffled = sorted(ids)
    random.Random(seed).shuffle(shuffled)
    return [i for i in shuffled if i not in exclude][:size]


def show(index: int, total: int, q: Any) -> tuple[list[str], list[str]]:
    options = [q.answer, q.wrong_1, q.wrong_2, q.wrong_3]
    options_es = [q.answer_es, q.wrong_1_es, q.wrong_2_es, q.wrong_3_es]
    print()
    print(LINE)
    print(f"[{index}/{total}] REVISIÓN DE TRADUCCIÓN (pregunta {q.id})")
    print(LINE)
    print(f"EN: {q.question}")
    print(f"ES: {q.question_es}")
    print()
    for n, (en, es) in enumerate(zip(options, options_es)):
        mark = "✔" if n == 0 else " "  # la primera es la correcta
        print(f" {mark} {en}  →  {es}")
    print(LINE)
    return options, options_es


def review(size: int, seed: int) -> None:
    # Con --sample 0 solo se muestra el reporte de las revisiones ya hechas
    if size <= 0:
        print_report(load_reviews())
        return

    reviewed = {int(r["question_id"]) for r in load_reviews()}
    db = SessionLocal()
    try:
        ids = [row.id for row in db.query(Question.id).filter(Question.is_translated.is_(True))]
        sample_ids = choose_sample(ids, size, reviewed, seed)
        if not sample_ids:
            print("No quedan preguntas traducidas sin revisar.")
            return

        for index, question_id in enumerate(sample_ids, start=1):
            q: Any = db.get(Question, question_id)
            options, options_es = show(index, len(sample_ids), q)

            rating = ask_rating()
            note = ""
            if rating in ("menor", "error"):
                note = input("¿Qué está mal? (Enter para omitir): ").strip()

            append_review(
                {
                    "question_id": q.id,
                    "question": q.question,
                    "question_es": q.question_es,
                    "options": " | ".join(options),
                    "options_es": " | ".join(options_es),
                    "rating": rating,
                    "note": note,
                    "reviewed_at": datetime.now(timezone.utc).isoformat(),
                }
            )
    except KeyboardInterrupt:
        print("\n\nInterrumpido. Las revisiones hechas quedaron guardadas.")
    finally:
        db.close()

    print_report(load_reviews())


def summarize(reviews: list[dict[str, str]]) -> dict[str, int]:
    """Cuenta las revisiones por calificación (las salteadas no cuentan)."""
    counts = {name: 0 for name in RATINGS.values()}
    for r in reviews:
        if r["rating"] in counts:
            counts[r["rating"]] += 1
    return counts


def print_report(reviews: list[dict[str, str]]) -> None:
    """Calidad acumulada de todas las revisiones del CSV."""
    counts = summarize(reviews)
    n = sum(counts.values())
    skipped = len(reviews) - n

    print()
    print(LINE)
    print("CALIDAD DE LA TRADUCCIÓN AUTOMÁTICA (revisión humana)")
    print(LINE)
    if not n:
        print("Todavía no hay revisiones.")
        return

    usable = counts["bien"] + counts["menor"]
    # Intervalos de confianza del 95% (Wilson): rango donde está el valor real
    low_ok, high_ok = wilson_interval(counts["bien"], n)
    low_use, high_use = wilson_interval(usable, n)

    print(f"Revisadas:   {n} ({skipped} salteadas)")
    print(f"Bien:        {counts['bien']}  |  Menor: {counts['menor']}  |  Error: {counts['error']}")
    print(f"Perfectas:   {counts['bien'] / n:.1%} (IC 95%: {low_ok:.1%} a {high_ok:.1%})")
    print(f"Jugables:    {usable / n:.1%} (IC 95%: {low_use:.1%} a {high_use:.1%})"
          "  ← bien + menor")

    notes = [r for r in reviews if r["note"]]
    if notes:
        print()
        print("Notas (sirven para el glosario de correcciones):")
        for r in notes:
            print(f"  [{r['rating']}] #{r['question_id']}: {r['note']}")
    print(LINE)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Revisión humana de las traducciones")
    parser.add_argument("--sample", type=int, default=50,
                        help="Cantidad de preguntas a revisar (0 = solo mostrar el reporte)")
    parser.add_argument("--seed", type=int, default=42,
                        help="Semilla de la muestra (la misma semilla elige las mismas preguntas)")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    review(args.sample, args.seed)