"""Validación de entradas de la API: los datos inválidos se rechazan con 422."""
import pytest

from app.schemas import MAX_OPTION_LENGTH, MAX_QUESTION_LENGTH

VALID_QUESTION = {
    "question": "¿Cuál es la capital de Chaco?",
    "answer": "Resistencia",
    "wrong_1": "Corrientes",
    "wrong_2": "Formosa",
    "wrong_3": "Posadas",
    "category": "Geografía",
}


def failed_fields(response) -> list[str]:
    """Nombres de los campos que Pydantic marcó como inválidos en un 422."""
    return [error["loc"][-1] for error in response.json()["detail"]]


# --- POST /questions: datos inválidos ---

def test_create_question_missing_field(client):
    incomplete = {k: v for k, v in VALID_QUESTION.items() if k != "wrong_3"}
    r = client.post("/questions", json=incomplete)
    assert r.status_code == 422
    assert "wrong_3" in failed_fields(r)


@pytest.mark.parametrize("changes", [
    {"question": "   "},                               # vacío (solo espacios)
    {"wrong_1": "Resistencia"},                        # opción repetida
    {"wrong_1": "resistencia"},                        # repetida con otras mayúsculas
    {"question": "x" * (MAX_QUESTION_LENGTH + 1)},     # pregunta demasiado larga
    {"answer": "x" * (MAX_OPTION_LENGTH + 1)},         # opción demasiado larga
    {"answer": 123},                                   # no es texto
    {"category": "Cocina"},                            # categoría inexistente
    {"source": "kth8/OpenTriviaQA"},                   # campo que no se acepta
], ids=[
    "vacio", "repetida", "repetida-mayusculas", "pregunta-larga",
    "opcion-larga", "no-texto", "categoria-inexistente", "campo-extra",
])
def test_invalid_question_is_rejected(client, changes):
    r = client.post("/questions", json={**VALID_QUESTION, **changes})
    assert r.status_code == 422


def test_rejected_question_is_not_saved(client):
    client.post("/questions", json={**VALID_QUESTION, "wrong_1": "Resistencia"})
    assert client.get("/stats").json()["total"] == 3


# --- POST /questions: datos válidos en el límite ---

def test_question_at_max_length_is_accepted(client):
    r = client.post("/questions", json={
        **VALID_QUESTION,
        "question": "x" * MAX_QUESTION_LENGTH,
        "answer": "y" * MAX_OPTION_LENGTH,
    })
    assert r.status_code == 201


def test_created_question_is_normalized(client):
    r = client.post("/questions", json={
        **VALID_QUESTION,
        "question": "  ¿Cuál es la capital de Chaco?  ",
        "category": "GEOGRAFIA",
    })
    assert r.status_code == 201
    created = r.json()
    assert created["question"] == "¿Cuál es la capital de Chaco?"  # sin espacios
    assert created["category"] == "Geografía"   # se guarda como etiqueta
    assert created["source"] == "manual"        # lo pone la API, no el cliente


# --- PUT /categorizations/{id} ---

@pytest.mark.parametrize("body", [
    {"category_name": "inexistente"},
    {},
    {"category_name": 123},
    {"category_name": "   "},
    {"category_name": "arte", "is_automatic": True},
], ids=["inexistente", "sin-campo", "no-texto", "vacio", "campo-extra"])
def test_invalid_categorization_update_is_rejected(client, body):
    r = client.put("/categorizations/1", json=body)
    assert r.status_code == 422


def test_update_categorization_accepts_label(client):
    r = client.put("/categorizations/1", json={"category_name": "Arte"})
    assert r.status_code == 200
    assert r.json()["category_name"] == "arte"


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