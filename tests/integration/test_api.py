"""Tests de integración de la API: endpoints + base de datos de prueba."""

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


def test_list_by_category_includes_categorization_id(client):
    data = client.get("/questions/category/geografia").json()
    assert data[0]["categorization_id"] == 1


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


# --- Corregir categorizaciones ---

def test_update_categorization(client):
    r = client.put("/categorizations/1", json={"category_name": "historia"})
    assert r.status_code == 200
    data = r.json()
    assert data["category_name"] == "historia"
    assert data["is_automatic"] is False

    # Ahora aparece en Historia y ya no en Geografía
    assert len(client.get("/questions/category/historia").json()) == 1
    assert client.get("/questions/category/geografia").json() == []

    # Y en las estadísticas cuenta como manual
    stats = client.get("/categories/stats").json()
    assert stats["automatic"] == 0
    assert stats["manual"] == 2


def test_update_categorization_ignores_case(client):
    r = client.put("/categorizations/1", json={"category_name": "ARTE"})
    assert r.status_code == 200
    assert r.json()["category_name"] == "arte"


def test_update_categorization_not_found(client):
    r = client.put("/categorizations/999", json={"category_name": "historia"})
    assert r.status_code == 404