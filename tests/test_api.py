import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import get_db
from app.main import app
from app.models import Base, Categorization, Question

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
    # Antes de cada test: 3 preguntas, 2 de ellas categorizadas
    Base.metadata.create_all(bind=engine_test)
    db = TestingSession()

    france = make_question("¿Capital de Francia?", "París", "Geografía")
    italy = make_question("¿Capital de Italia?", "Roma", "Geografía")
    mona_lisa = make_question("¿Quién pintó la Mona Lisa?", "Da Vinci", "Arte")
    db.add_all([france, italy, mona_lisa])
    db.flush()  # asigna los ids sin cerrar la transacción

    db.add_all([
        Categorization(question_id=france.id, category_name="geografia",
                       confidence_score=0.95, is_automatic=True),
        Categorization(question_id=mona_lisa.id, category_name="arte",
                       confidence_score=0.40, is_automatic=False),
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


# --- Preguntas por categoría asignada ---

def test_list_by_category(client):
    r = client.get("/questions/category/geografia")
    assert r.status_code == 200
    data = r.json()
    # Hay 2 preguntas de Geografía en el dataset, pero solo 1 categorizada
    assert len(data) == 1
    assert data[0]["question"] == "¿Capital de Francia?"
    assert data[0]["category_name"] == "geografia"
    assert data[0]["original_category"] == "Geografía"
    assert data[0]["is_automatic"] is True


def test_list_by_category_ignores_case(client):
    r = client.get("/questions/category/GEOGRAFIA")
    assert r.status_code == 200
    assert len(r.json()) == 1


def test_list_by_category_without_results(client):
    r = client.get("/questions/category/historia")
    assert r.status_code == 200
    assert r.json() == []


def test_list_by_category_unknown(client):
    r = client.get("/questions/category/inexistente")
    assert r.status_code == 404


# --- Categorías ---

def test_list_categories(client):
    r = client.get("/categories")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 6
    assert all({"name", "label", "description"} <= c.keys() for c in data)


def test_category_stats(client):
    r = client.get("/categories/stats")
    assert r.status_code == 200
    assert r.json() == {
        "total_questions": 3,
        "categorized": 2,
        "uncategorized": 1,
        "automatic": 1,
        "manual": 1,
        "by_category": {"arte": 1, "geografia": 1},
    }


# --- Estadísticas del dataset ---

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