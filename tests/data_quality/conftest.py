"""Fixture de conexión a la base real (PostgreSQL) para los tests de calidad de datos."""
import pytest
from sqlalchemy import func, text
from sqlalchemy.exc import OperationalError

from app.database import SessionLocal
from app.models import Question


@pytest.fixture(scope="module")
def real_db():
    """Sesión sobre la base real. Saltea los tests si no está disponible o vacía."""
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
    except OperationalError:
        db.close()
        pytest.skip("PostgreSQL no está disponible (¿está corriendo docker compose up -d?)")

    if not db.query(func.count(Question.id)).scalar():
        db.close()
        pytest.skip("La base no tiene preguntas cargadas (correr app.load_data)")

    yield db
    db.close()