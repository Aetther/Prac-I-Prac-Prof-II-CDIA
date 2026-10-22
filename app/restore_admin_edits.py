"""
Vuelve a aplicar a la base las correcciones del admin de data/admin_edits.csv.

Se corre al final, después de traducir y del glosario, así lo que corrigió
una persona gana sobre lo automático:
    load_data -> restore_decisions -> categorize -> translate_questions
    -> apply_glossary -> restore_admin_edits

- Cada pregunta se busca por su texto original en inglés y su respuesta
  original (no por el id).
- Se controlan las mismas reglas que en PATCH /questions/{id}: si los cambios
  dejarían opciones repetidas, esa pregunta no se toca y se avisa.
- Cada cambio queda en el historial (question_edits), como si lo hubiera hecho
  el admin, así una exportación posterior da el mismo CSV.

Por defecto solo muestra los cambios; con --apply los guarda.
Se puede correr las veces que haga falta: lo ya aplicado no cambia.

Uso:
    poetry run python -m app.restore_admin_edits            (solo muestra)
    poetry run python -m app.restore_admin_edits --apply    (guarda)
"""
import argparse
from collections import defaultdict
from typing import Any

from app.admin_edits import EDITS_FILE, check_changes, load_admin_edits, parse_value
from app.database import SessionLocal
from app.main import MANUAL_TRANSLATION, edit_value
from app.models import Question, QuestionEdit
from app.schemas import EN_FIELDS, ES_FIELDS

LINE = "═" * 64


def questions_by_original_text(db) -> dict[tuple[str, str], Any]:
    """
    {(pregunta original, respuesta original): pregunta}. Si el admin ya cambió
    el inglés en esta base, el original sale del historial (el valor anterior
    de la primera edición de ese campo).
    """
    first_old: dict[tuple[int, str], str] = {}
    edits: list[Any] = (
        db.query(QuestionEdit)
        .filter(QuestionEdit.field.in_(["question", "answer"]))
        .order_by(QuestionEdit.edited_at, QuestionEdit.id)
        .all()
    )
    for edit in edits:
        first_old.setdefault((edit.question_id, edit.field), edit.old_value)

    questions: list[Any] = db.query(Question).all()
    return {
        (
            first_old.get((q.id, "question")) or q.question,
            first_old.get((q.id, "answer")) or q.answer,
        ): q
        for q in questions
    }


def main(save: bool) -> None:
    # {(pregunta, respuesta): {campo: valor}}
    wanted: dict[tuple[str, str], dict[str, Any]] = defaultdict(dict)
    for edit in load_admin_edits(EDITS_FILE):
        wanted[(edit.question, edit.answer)][edit.field] = parse_value(edit.field, edit.value)

    db = SessionLocal()
    applied: list[tuple[int, str, Any, Any]] = []  # (id, campo, antes, después)
    problems: list[str] = []
    try:
        index = questions_by_original_text(db)
        for (text, answer), fields in wanted.items():
            question = index.get((text, answer))
            if question is None:
                problems.append(f"No se encontró la pregunta: {text[:70]} ({answer})")
                continue

            changes = {f: v for f, v in fields.items() if getattr(question, f) != v}
            if not changes:
                continue  # ya estaba aplicado

            current = {f: getattr(question, f) for f in (*EN_FIELDS, *ES_FIELDS)}
            error, translating = check_changes(current, question.is_translated, changes)
            if error:
                problems.append(f"#{question.id}: {error} (no se aplicó)")
                continue

            for field, value in changes.items():
                old = getattr(question, field)
                db.add(
                    QuestionEdit(
                        question_id=question.id,
                        field=field,
                        old_value=edit_value(old),
                        new_value=edit_value(value),
                    )
                )
                applied.append((question.id, field, old, value))
                setattr(question, field, value)
            if translating:
                question.is_translated = True
                question.translation_model = MANUAL_TRANSLATION

        print(LINE)
        print(f"CORRECCIONES DEL ADMIN: {sum(len(f) for f in wanted.values())} en {EDITS_FILE}")
        print(LINE)
        for question_id, field, before, after in applied:
            print(f"#{question_id} {field}:\n   antes:   {before}\n   después: {after}")
        print(LINE)
        print(f"Cambios: {len(applied)}")
        for problem in problems:
            print(f"  ⚠ {problem}")

        if save and applied:
            db.commit()
            print("Cambios guardados.")
        else:
            db.rollback()
            if applied:
                print("No se guardó nada (para guardar: --apply).")
            else:
                print("Todo está al día: no hay nada que cambiar.")
    finally:
        db.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Vuelve a aplicar las correcciones del admin")
    parser.add_argument("--apply", action="store_true",
                        help="Guardar los cambios (sin esto, solo se muestran)")
    return parser.parse_args()


if __name__ == "__main__":
    main(parse_args().apply)