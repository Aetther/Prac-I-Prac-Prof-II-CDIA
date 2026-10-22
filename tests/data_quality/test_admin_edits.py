"""Calidad de datos: las correcciones del admin están aplicadas en la base real."""
from app.admin_edits import load_admin_edits, parse_value
from app.restore_admin_edits import questions_by_original_text


def test_admin_edits_are_applied(real_db):
    index = questions_by_original_text(real_db)
    pending = []
    for edit in load_admin_edits():
        question = index.get((edit.question, edit.answer))
        if question is None or getattr(question, edit.field) != parse_value(edit.field, edit.value):
            pending.append(f"{edit.question[:40]} ({edit.field})")
    assert pending == [], (
        f"Correcciones del admin sin aplicar: {pending[:10]} "
        "(correr app.restore_admin_edits --apply)"
    )