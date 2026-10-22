"""Calidad de datos de la traducción al español (base real en PostgreSQL)."""
from typing import Any

import pytest
from sqlalchemy import func

from app.glossary import fix_punctuation, load_corrections, target_field
from app.main import MANUAL_TRANSLATION
from app.model_versions import MODEL_REVISIONS
from app.models import Question

ES_FIELDS = ["question_es", "answer_es", "wrong_1_es", "wrong_2_es", "wrong_3_es"]
MIN_COVERAGE = 0.95


def translated_rows(real_db) -> list[Any]:
    return (
        real_db.query(Question.id, *[getattr(Question, f) for f in ES_FIELDS])
        .filter(Question.is_translated.is_(True))
        .all()
    )


def test_most_questions_are_translated(real_db):
    total = real_db.query(func.count(Question.id)).scalar()
    translated = (
        real_db.query(func.count(Question.id))
        .filter(Question.is_translated.is_(True))
        .scalar()
    )
    if translated == 0:
        pytest.skip("Todavía no hay traducciones (correr app.translate_questions)")
    assert translated / total >= MIN_COVERAGE, (
        f"Solo {translated} de {total} preguntas traducidas"
    )


def test_translated_questions_have_every_field(real_db):
    bad = [
        row.id
        for row in translated_rows(real_db)
        if any(not (getattr(row, f) or "").strip() for f in ES_FIELDS)
    ]
    assert bad == [], f"Traducciones incompletas: {bad[:10]}"


def test_translated_options_are_distinct(real_db):
    bad = [
        row.id
        for row in translated_rows(real_db)
        if len({(getattr(row, f) or "").strip().casefold() for f in ES_FIELDS[1:]}) != 4
    ]
    assert bad == [], f"Traducciones con opciones repetidas: {bad[:10]}"


def test_translations_record_a_pinned_model(real_db):
    models = {
        name
        for (name,) in real_db.query(Question.translation_model)
        .filter(Question.is_translated.is_(True))
        .distinct()
    }
    # Cada traducción tiene que decir con qué modelo se hizo, y ese modelo
    # tiene que tener una versión fija (app/model_versions.py). Las que tradujo
    # a mano un admin dicen "manual".
    assert None not in models
    assert models <= set(MODEL_REVISIONS) | {MANUAL_TRANSLATION}


def test_untranslated_questions_have_no_partial_translation(real_db):
    partial = (
        real_db.query(func.count(Question.id))
        .filter(Question.is_translated.is_(False), Question.question_es.is_not(None))
        .scalar()
    )
    assert partial == 0


def test_punctuation_rule_is_applied(real_db):
    bad = [
        row.id
        for row in translated_rows(real_db)
        if fix_punctuation(row.question_es) != row.question_es
    ]
    assert bad == [], (
        f"Preguntas sin la regla de puntuación: {bad[:10]} (correr app.apply_glossary --apply)"
    )


def test_glossary_corrections_are_applied(real_db):
    pending = []
    for c in load_corrections():
        q: Any = real_db.get(Question, c.question_id)
        field = target_field(q, c.target) if q is not None else None
        if field is None or getattr(q, field) != c.es:
            pending.append(f"#{c.question_id} ({c.target})")
    assert pending == [], (
        f"Correcciones sin aplicar: {pending[:10]} (correr app.apply_glossary --apply)"
    )