import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import get_db
from app.models import Base, Question

# Base de datos SQLite en memoria, solo para los tests
engine_test = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSession = sessionmaker(bind=engine_test, autoflush=False)


def make_question(text, answer, category):
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
def client():
    # Antes de cada test: tablas nuevas con 3 preguntas de ejemplo
    Base.metadata.create_all(bind=engine_test)
    db = TestingSession()
    db.add_all([
        make_question("¿Capital de Francia?", "París", "Geografía"),
        make_question("¿Capital de Italia?", "Roma", "Geografía"),
        make_question("¿Quién pintó la Mona Lisa?", "Da Vinci", "Arte"),
    ])
    db.commit()
    db.close()

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)

    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine_test)


VALID_QUESTION = {
    "question": "¿Cuál es la capital de Chaco?",
    "answer": "Resistencia",
    "wrong_1": "Corrientes",
    "wrong_2": "Formosa",
    "wrong_3": "Posadas",
    "category": "Geografía",
}


# --- Filtro por categoría ---

def test_filter_by_category(client):
    r = client.get("/questions/category/Geografía")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 2
    assert all(q["category"] == "Geografía" for q in data)


def test_filter_by_category_ignores_case(client):
    r = client.get("/questions/category/geografía")
    assert r.status_code == 200
    assert len(r.json()) == 2


def test_filter_by_category_not_found(client):
    r = client.get("/questions/category/Inexistente")
    assert r.status_code == 404


# --- Estadísticas ---

def test_stats(client):
    r = client.get("/stats")
    assert r.status_code == 200
    data = r.json()
    assert data["total"] == 3
    assert data["by_category"] == {"Arte": 1, "Geografía": 2}


# --- Crear preguntas ---

def test_create_question(client):
    r = client.post("/questions", json=VALID_QUESTION)
    assert r.status_code == 201
    created = r.json()
    assert created["id"] is not None
    assert created["answer"] == "Resistencia"

    # Ahora debería contarse en las estadísticas
    stats = client.get("/stats").json()
    assert stats["total"] == 4
    assert stats["by_category"]["Geografía"] == 3


def test_create_question_missing_field(client):
    incomplete = {k: v for k, v in VALID_QUESTION.items() if k != "wrong_3"}
    r = client.post("/questions", json=incomplete)
    assert r.status_code == 400
    assert "wrong_3" in r.json()["detail"]


def test_create_question_repeated_options(client):
    repeated = {**VALID_QUESTION, "wrong_1": "Resistencia"}
    r = client.post("/questions", json=repeated)
    assert r.status_code == 400