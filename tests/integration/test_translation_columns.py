"""
ensure_question_columns: agrega las columnas nuevas (traducción y
administración) a una tabla creada antes de ellas (create_all no modifica
tablas existentes).
"""
import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.pool import StaticPool

from app.models import ADDED_COLUMNS, Question, ensure_question_columns

# La tabla questions como era antes de agregar la traducción
OLD_QUESTIONS_TABLE = """
CREATE TABLE questions (
    id INTEGER PRIMARY KEY,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    wrong_1 TEXT NOT NULL,
    wrong_2 TEXT NOT NULL,
    wrong_3 TEXT NOT NULL,
    category VARCHAR(100),
    source VARCHAR(255)
)
"""


def new_engine():
    return create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )


@pytest.fixture
def old_database():
    """Base SQLite con la tabla vieja y una pregunta cargada."""
    engine = new_engine()
    with engine.begin() as connection:
        connection.execute(text(OLD_QUESTIONS_TABLE))
        connection.execute(text(
            "INSERT INTO questions (question, answer, wrong_1, wrong_2, wrong_3) "
            "VALUES ('Capital of France?', 'Paris', 'Rome', 'Madrid', 'Berlin')"
        ))
    yield engine
    engine.dispose()


def column_names(engine) -> set[str]:
    return {column["name"] for column in inspect(engine).get_columns("questions")}


def test_added_columns_are_model_columns():
    # Los tipos salen del modelo: cada nombre tiene que ser una columna de Question
    assert set(ADDED_COLUMNS) <= set(Question.__table__.c.keys())


def test_adds_missing_columns(old_database):
    added = ensure_question_columns(old_database)
    assert added == list(ADDED_COLUMNS)
    assert set(ADDED_COLUMNS) <= column_names(old_database)


def test_existing_questions_get_the_defaults(old_database):
    ensure_question_columns(old_database)
    with old_database.connect() as connection:
        row = connection.execute(
            text("SELECT question, is_translated, question_es, is_active FROM questions")
        ).one()
    assert row.question == "Capital of France?"  # los datos no se tocan
    assert not row.is_translated  # sin traducir
    assert row.question_es is None
    assert row.is_active  # visible en el juego


def test_running_twice_does_nothing(old_database):
    ensure_question_columns(old_database)
    assert ensure_question_columns(old_database) == []


def test_without_table_does_nothing():
    # Si la tabla no existe todavía, create_all la crea completa
    engine = new_engine()
    assert ensure_question_columns(engine) == []
    engine.dispose()