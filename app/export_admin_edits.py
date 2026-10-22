"""
Exporta las correcciones del admin a data/admin_edits.csv.

Lee el historial de la base (question_edits) y guarda el valor final de cada
campo editado de cada pregunta. Se junta con lo que ya había en el CSV:
- lo nuevo reemplaza lo viejo del mismo campo de la misma pregunta,
- si el admin deshizo un cambio, se saca del CSV,
- lo que no se tocó en esta base (por ejemplo, ediciones hechas en otra
  computadora) se conserva.

Después de exportar, hay que subir el CSV al repositorio. Para volver a
aplicarlo en una base nueva: poetry run python -m app.restore_admin_edits

Uso:
    poetry run python -m app.export_admin_edits
"""
from typing import Any

from app.admin_edits import (
    EDITS_FILE,
    EditRecord,
    edited_keys,
    load_admin_edits,
    merge_edits,
    save_admin_edits,
    summarize_edits,
)
from app.database import SessionLocal
from app.models import Question, QuestionEdit


def main() -> None:
    db = SessionLocal()
    try:
        rows: list[Any] = (
            db.query(QuestionEdit).order_by(QuestionEdit.edited_at, QuestionEdit.id).all()
        )
        history = [EditRecord(r.question_id, r.field, r.old_value, r.new_value) for r in rows]
        ids = {record.question_id for record in history}
        questions: list[Any] = (
            db.query(Question.id, Question.question, Question.answer)
            .filter(Question.id.in_(sorted(ids)))
            .all()
            if ids
            else []
        )
        current = {q.id: (q.question, q.answer) for q in questions}
    finally:
        db.close()

    new = summarize_edits(history, current)
    touched = edited_keys(history, current)
    existing = load_admin_edits(EDITS_FILE)

    # Lo que se tocó en esta base se reemplaza por su valor final (o se saca,
    # si el admin lo deshizo); lo demás queda como estaba
    kept = [edit for edit in existing if edit.key not in touched]
    merged = merge_edits(kept, new)
    save_admin_edits(merged, EDITS_FILE)

    before = {edit.key: edit.value for edit in existing}
    new_keys = {edit.key for edit in new}
    added = sum(1 for edit in new if edit.key not in before)
    updated = sum(1 for edit in new if edit.key in before and before[edit.key] != edit.value)
    removed = sum(1 for key in before if key in touched and key not in new_keys)

    print(f"Historial: {len(history)} ediciones de {len(ids)} preguntas")
    print(f"Correcciones nuevas:       {added}")
    print(f"Correcciones actualizadas: {updated}")
    print(f"Correcciones deshechas:    {removed}")
    print(f"Total en {EDITS_FILE}: {len(merged)}")


if __name__ == "__main__":
    main()