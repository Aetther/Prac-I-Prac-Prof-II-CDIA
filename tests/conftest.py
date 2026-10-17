"""
Configuración compartida por todos los tests.

- Marca cada test según su carpeta (unit, integration, data_quality, validation),
  para poder correr un solo tipo con: poetry run pytest -m unit
- Define una base SQLite en memoria y un cliente de la API que la usa.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import get_db
from app.main import app
from app.models import Base, Categorization, Question

TEST_TYPES = {"unit", "integration", "data_quality", "validation"}

# API key usada solo en los tests (no es la real del .env)
TEST_API_KEY = "clave-de-prueba"


def pytest_collection_modifyitems(items):
    """Agrega a cada test el marcador del nombre de su carpeta."""
    for item in items:
        folder = item.path.parent.name
        if folder in TEST_TYPES:
            item.add_marker(getattr(pytest.mark, folder))


# Base de datos SQLite en memoria, solo para los tests
engine_test = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSession = sessionmaker(bind=engine_test, autoflush=False)


def make_question(text: str, answer: str, category: str) -> Question:
    return Question(
        question=text,
        answer=answer,
        wrong_1="Opción A",
        wrong_2="Opción B",
        wrong_3="Opción C",
        category=category,
        source="test",
    )


@pytest.fixture
def db_session():
    """Base vacía, creada antes de cada test y borrada después."""
    Base.metadata.create_all(bind=engine_test)
    db = TestingSession()
    yield db
    db.close()
    Base.metadata.drop_all(bind=engine_test)


@pytest.fixture
def seeded_db(db_session):
    """3 preguntas, 2 de ellas categorizadas (una automática y una manual)."""
    france = make_question("¿Capital de Francia?", "París", "Geografía")
    italy = make_question("¿Capital de Italia?", "Roma", "Geografía")
    mona_lisa = make_question("¿Quién pintó la Mona Lisa?", "Da Vinci", "Arte")
    db_session.add_all([france, italy, mona_lisa])
    db_session.flush()  # asigna los ids sin cerrar la transacción

    db_session.add_all([
        Categorization(question_id=france.id, category_name="geografia",
                       confidence_score=0.95, is_automatic=True),
        Categorization(question_id=mona_lisa.id, category_name="arte",
                       confidence_score=0.40, is_automatic=False),
    ])
    db_session.commit()
    return db_session


@pytest.fixture
def anon_client(seeded_db, monkeypatch):
    """Cliente de la API conectado a la base de prueba, SIN API key."""
    monkeypatch.setenv("API_KEY", TEST_API_KEY)

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def client(anon_client):
    """Cliente de la API con la API key de prueba en todos los pedidos."""
    anon_client.headers.update({"X-API-Key": TEST_API_KEY})
    return anon_client