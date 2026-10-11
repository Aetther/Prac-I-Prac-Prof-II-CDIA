"""Calidad de datos de las preguntas cargadas en PostgreSQL."""
import re
from typing import Any

from sqlalchemy import func, or_

from app.categories import get_category_labels
from app.models import Question

TEXT_FIELDS = ["question", "answer", "wrong_1", "wrong_2", "wrong_3"]

# Caracteres de control C1 (\x80-\x9f) y la secuencia "â€": huellas típicas
# de texto mal codificado. Algunos incluso pueden trabar la terminal.
ENCODING_ERROR = re.compile(r"[\x80-\x9f]|â€")


def all_rows(real_db) -> list[Any]:
    return real_db.query(Question.id, *[getattr(Question, f) for f in TEXT_FIELDS]).all()


def test_dataset_was_fully_loaded(real_db):
    total = real_db.query(func.count(Question.id)).scalar()
    assert total > 20000, f"Solo hay {total} preguntas: la carga parece incompleta"


def test_no_empty_fields(real_db):
    empty = real_db.query(Question).filter(
        or_(*[func.trim(getattr(Question, f)) == "" for f in TEXT_FIELDS])
    ).count()
    assert empty == 0


def test_four_distinct_options(real_db):
    bad = [
        row.id
        for row in all_rows(real_db)
        if len({row.answer.lower(), row.wrong_1.lower(), row.wrong_2.lower(), row.wrong_3.lower()}) != 4
    ]
    assert bad == [], f"Preguntas con opciones repetidas: {bad[:10]}"


def test_categories_are_valid(real_db):
    invalid = real_db.query(Question).filter(
        ~Question.category.in_(get_category_labels())
    ).count()
    assert invalid == 0


def test_every_category_has_enough_questions(real_db):
    counts = dict(
        real_db.query(Question.category, func.count(Question.id)).group_by(Question.category).all()
    )
    for label in get_category_labels():
        assert counts.get(label, 0) >= 500, f"{label} tiene solo {counts.get(label, 0)} preguntas"


def test_no_encoding_errors(real_db):
    bad = [
        row.id
        for row in all_rows(real_db)
        if any(ENCODING_ERROR.search(getattr(row, f)) for f in TEXT_FIELDS)
    ]
    assert bad == [], f"Preguntas con texto mal codificado: {bad[:10]}"


def test_question_and_answer_pairs_are_unique(real_db):
    # restore_decisions identifica las preguntas por (pregunta, respuesta):
    # si hubiera repetidos, una decisión humana podría asignarse a la pregunta equivocada.
    duplicates = (
        real_db.query(Question.question, Question.answer)
        .group_by(Question.question, Question.answer)
        .having(func.count(Question.id) > 1)
        .all()
    )
    assert duplicates == [], f"Pares repetidos: {duplicates[:5]}"

def test_no_true_false_options(real_db):
    bad = [
        row.id
        for row in all_rows(real_db)
        if any(getattr(row, f).lower() in ("true", "false") for f in TEXT_FIELDS[1:])
    ]
    assert bad == [], f"Preguntas con opciones True/False: {bad[:10]}"