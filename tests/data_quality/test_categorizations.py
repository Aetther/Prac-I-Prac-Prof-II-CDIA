"""Calidad de datos de las categorizaciones guardadas en PostgreSQL."""
from sqlalchemy import func

from app.categories import get_category_names
from app.models import Categorization

# Mismo umbral que app/categorize.py (no se importa de ahí porque
# categorize.py carga los modelos de IA)
CONFIDENCE_THRESHOLD = 0.70


def test_category_names_are_valid(real_db):
    invalid = real_db.query(Categorization).filter(
        ~Categorization.category_name.in_(get_category_names())
    ).count()
    assert invalid == 0


def test_confidence_is_between_0_and_1(real_db):
    out_of_range = real_db.query(Categorization).filter(
        (Categorization.confidence_score < 0) | (Categorization.confidence_score > 1)
    ).count()
    assert out_of_range == 0


def test_one_categorization_per_question(real_db):
    total = real_db.query(func.count(Categorization.id)).scalar()
    distinct_questions = real_db.query(
        func.count(func.distinct(Categorization.question_id))
    ).scalar()
    assert total == distinct_questions


def test_automatic_categorizations_respect_the_threshold(real_db):
    # Una categorización automática solo es válida si la IA superó el umbral
    below = real_db.query(Categorization).filter(
        Categorization.is_automatic.is_(True),
        Categorization.confidence_score < CONFIDENCE_THRESHOLD,
    ).count()
    assert below == 0