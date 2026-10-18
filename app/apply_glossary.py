"""
Aplica el glosario de correcciones a las traducciones guardadas en la base.

1. Regla de puntuación (app/glossary.py) en todas las preguntas traducidas.
2. Correcciones por pregunta de data/translation_corrections.csv.

Las correcciones humanas van después, así que si las dos tocan lo mismo,
gana la humana. Por defecto solo muestra los cambios; con --apply los guarda.
Se puede correr las veces que haga falta: lo ya corregido no cambia.

Uso:
    poetry run python -m app.apply_glossary            (solo muestra)
    poetry run python -m app.apply_glossary --apply    (guarda)
"""
import argparse
from typing import Any

from app.database import SessionLocal
from app.glossary import fix_punctuation, load_corrections, options_are_distinct, target_field
from app.models import Question

LINE = "═" * 64


def apply_glossary(save: bool) -> None:
    corrections = load_corrections()
    db = SessionLocal()
    changes: list[tuple[int, str, str, str]] = []  # (id, columna, antes, después)
    problems: list[str] = []
    try:
        rows: list[Any] = (
            db.query(Question).filter(Question.is_translated.is_(True)).all()
        )
        by_id = {q.id: q for q in rows}

        # 1. Regla general de puntuación
        for q in rows:
            fixed = fix_punctuation(q.question_es)
            if fixed != q.question_es:
                changes.append((q.id, "question_es", q.question_es, fixed))
                q.question_es = fixed

        # 2. Correcciones por pregunta (ganan sobre la regla)
        for c in corrections:
            q = by_id.get(c.question_id)
            if q is None:
                problems.append(f"#{c.question_id}: no existe o no está traducida")
                continue
            field = target_field(q, c.target)
            if field is None:
                problems.append(f"#{c.question_id}: ninguna opción es '{c.target}'")
                continue
            if getattr(q, field) != c.es:
                changes.append((q.id, field, getattr(q, field), c.es))
                setattr(q, field, c.es)

        # Una corrección no puede dejar opciones repetidas
        for question_id in sorted({i for i, *_ in changes}):
            q = by_id[question_id]
            if not options_are_distinct([q.answer_es, q.wrong_1_es, q.wrong_2_es, q.wrong_3_es]):
                problems.append(f"#{q.id}: las correcciones dejan opciones repetidas")

        print(LINE)
        print(f"GLOSARIO: {len(corrections)} correcciones en el CSV")
        print(LINE)
        for question_id, field, before, after in changes:
            print(f"#{question_id} {field}:\n   antes:   {before}\n   después: {after}")
        print(LINE)
        print(f"Cambios: {len(changes)}")
        for problem in problems:
            print(f"  ⚠ {problem}")

        if problems:
            db.rollback()
            print("Hay problemas: no se guardó nada. Corregir el CSV y volver a correr.")
        elif save and changes:
            db.commit()
            print("Cambios guardados.")
        else:
            db.rollback()
            if changes:
                print("No se guardó nada (para guardar: --apply).")
            else:
                print("Todo está al día: no hay nada que cambiar.")
    finally:
        db.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Aplica el glosario de correcciones de la traducción")
    parser.add_argument("--apply", action="store_true",
                        help="Guardar los cambios (sin esto, solo se muestran)")
    return parser.parse_args()


if __name__ == "__main__":
    apply_glossary(parse_args().apply)