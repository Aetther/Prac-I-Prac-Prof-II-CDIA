"""
Aplica el glosario de correcciones a las traducciones guardadas en la base.

1. Regla de puntuación (app/glossary.py) en todas las preguntas traducidas.
2. Correcciones por pregunta de data/translation_corrections.csv.

Las correcciones humanas van después, así que si las dos tocan lo mismo,
gana la humana. Por defecto solo muestra los cambios; con --apply los guarda.
Se puede correr las veces que haga falta: lo ya corregido no cambia.

Lo que editó un admin desde la API (historial question_edits) no se toca:
- la regla de puntuación no cambia una pregunta en español que editó el admin,
- una corrección de una opción no se aplica si el admin editó alguna opción
  de esa pregunta (en inglés o en español), porque si cambió el inglés, la
  corrección ya no sabe a qué opción apunta.

Uso:
    poetry run python -m app.apply_glossary            (solo muestra)
    poetry run python -m app.apply_glossary --apply    (guarda)
"""
import argparse
from typing import Any

from app.database import SessionLocal
from app.glossary import (
    OPTION_FIELDS,
    QUESTION_TARGET,
    fix_punctuation,
    load_corrections,
    options_are_distinct,
    target_field,
)
from app.models import Question, QuestionEdit

LINE = "═" * 64

# Columnas de las opciones, en inglés y en español
OPTION_COLUMNS = (*OPTION_FIELDS, *OPTION_FIELDS.values())


def admin_edited_fields(db) -> set[tuple[int, str]]:
    """{(question_id, campo)} de todo lo que editó un admin desde la API."""
    rows: list[Any] = db.query(QuestionEdit.question_id, QuestionEdit.field).distinct().all()
    return {(row.question_id, row.field) for row in rows}


def edited_by_admin(question_id: int, target: str, edited: set[tuple[int, str]]) -> bool:
    """True si el admin editó lo que corrige esta corrección del glosario."""
    if target == QUESTION_TARGET:
        return (question_id, "question_es") in edited
    return any((question_id, column) in edited for column in OPTION_COLUMNS)


def apply_glossary(save: bool) -> None:
    corrections = load_corrections()
    db = SessionLocal()
    changes: list[tuple[int, str, str, str]] = []  # (id, columna, antes, después)
    problems: list[str] = []
    skipped: list[str] = []  # lo que no se toca porque lo editó el admin
    try:
        rows: list[Any] = (
            db.query(Question).filter(Question.is_translated.is_(True)).all()
        )
        by_id = {q.id: q for q in rows}
        edited = admin_edited_fields(db)

        # 1. Regla general de puntuación
        for q in rows:
            fixed = fix_punctuation(q.question_es)
            if fixed == q.question_es:
                continue
            if (q.id, "question_es") in edited:
                skipped.append(f"#{q.id} question_es (puntuación)")
                continue
            changes.append((q.id, "question_es", q.question_es, fixed))
            q.question_es = fixed

        # 2. Correcciones por pregunta (ganan sobre la regla)
        for c in corrections:
            q = by_id.get(c.question_id)
            if q is None:
                problems.append(f"#{c.question_id}: no existe o no está traducida")
                continue
            if edited_by_admin(q.id, c.target, edited):
                skipped.append(f"#{q.id} {c.target}")
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
        if skipped:
            print(f"Sin tocar porque las editó el admin: {len(skipped)}")
            for item in skipped:
                print(f"  · {item}")
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