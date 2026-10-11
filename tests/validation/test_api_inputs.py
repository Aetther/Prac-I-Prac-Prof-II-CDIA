"""Validación de entradas de la API: los datos inválidos se rechazan."""
import pytest

VALID_QUESTION = {
    "question": "¿Cuál es la capital de Chaco?",
    "answer": "Resistencia",
    "wrong_1": "Corrientes",
    "wrong_2": "Formosa",
    "wrong_3": "Posadas",
    "category": "Geografía",
}


# --- POST /questions ---

def test_create_question_missing_field(client):
    incomplete = {k: v for k, v in VALID_QUESTION.items() if k != "wrong_3"}
    r = client.post("/questions", json=incomplete)
    assert r.status_code == 400
    assert "wrong_3" in r.json()["detail"]


def test_create_question_blank_field(client):
    r = client.post("/questions", json={**VALID_QUESTION, "question": "   "})
    assert r.status_code == 400


def test_create_question_repeated_options(client):
    r = client.post("/questions", json={**VALID_QUESTION, "wrong_1": "Resistencia"})
    assert r.status_code == 400


def test_create_question_options_repeated_ignoring_case(client):
    r = client.post("/questions", json={**VALID_QUESTION, "wrong_1": "resistencia"})
    assert r.status_code == 400


def test_rejected_question_is_not_saved(client):
    client.post("/questions", json={**VALID_QUESTION, "wrong_1": "Resistencia"})
    assert client.get("/stats").json()["total"] == 3


# --- PUT /categorizations/{id} ---

def test_update_categorization_invalid_category(client):
    r = client.put("/categorizations/1", json={"category_name": "inexistente"})
    assert r.status_code == 400


def test_update_categorization_missing_field(client):
    r = client.put("/categorizations/1", json={})
    assert r.status_code == 400


def test_update_categorization_non_text_category(client):
    r = client.put("/categorizations/1", json={"category_name": 123})
    assert r.status_code == 400


def test_update_categorization_non_numeric_id(client):
    r = client.put("/categorizations/abc", json={"category_name": "arte"})
    assert r.status_code == 422


# --- Paginación ---

@pytest.mark.parametrize("params", [
    {"skip": -1},
    {"limit": 0},
    {"limit": -5},
    {"limit": 1000},
    {"limit": "abc"},
])
def test_invalid_pagination_is_rejected(client, params):
    assert client.get("/questions", params=params).status_code == 422
    assert client.get("/questions/category/arte", params=params).status_code == 422


def test_valid_pagination_is_accepted(client):
    r = client.get("/questions", params={"skip": 1, "limit": 1})
    assert r.status_code == 200
    assert len(r.json()) == 1