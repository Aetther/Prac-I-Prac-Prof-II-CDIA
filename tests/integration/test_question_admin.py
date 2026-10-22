"""
Administración de preguntas: editar, ocultar y volver a mostrar.

Base de prueba (ver tests/conftest.py):
  id 1: ¿Capital de Francia? -> París      (categorizada: geografia)
  id 2: ¿Capital de Italia?  -> Roma       (sin categorizar)
  id 3: ¿Quién pintó la Mona Lisa? -> Da Vinci (categorizada: arte)
Las incorrectas son siempre "Opción A", "Opción B" y "Opción C".
Ninguna está traducida al empezar.
"""
import pytest

SPANISH = {
    "question_es": "¿Cuál es la capital de Francia?",
    "answer_es": "París",
    "wrong_1_es": "Roma",
    "wrong_2_es": "Madrid",
    "wrong_3_es": "Berlín",
}


# --- Editar ---

def test_edit_one_field(client):
    r = client.patch("/questions/1", json={"answer": "Paris"})
    assert r.status_code == 200
    data = r.json()
    assert data["changed_fields"] == ["answer"]
    assert data["question"]["answer"] == "Paris"
    assert data["question"]["wrong_1"] == "Opción A"  # lo demás no cambia
    assert client.get("/questions/1").json()["answer"] == "Paris"


def test_edit_is_recorded_in_history(client):
    client.patch("/questions/1", json={"answer": "Paris"})
    edits = client.get("/questions/1/edits").json()
    assert len(edits) == 1
    assert edits[0]["field"] == "answer"
    assert edits[0]["old_value"] == "París"
    assert edits[0]["new_value"] == "Paris"
    assert edits[0]["edited_at"]


def test_same_value_is_not_recorded(client):
    r = client.patch("/questions/1", json={"answer": "París"})
    assert r.status_code == 200
    assert r.json()["changed_fields"] == []
    assert client.get("/questions/1/edits").json() == []


def test_text_is_trimmed(client):
    data = client.patch("/questions/1", json={"answer": "  Paris  "}).json()
    assert data["question"]["answer"] == "Paris"


def test_repeated_options_are_rejected(client):
    # "opción a" ya es una incorrecta (sin distinguir mayúsculas)
    r = client.patch("/questions/1", json={"answer": "opción a"})
    assert r.status_code == 422
    assert "inglés" in r.json()["detail"]
    # No cambió nada ni quedó registrado
    assert client.get("/questions/1").json()["answer"] == "París"
    assert client.get("/questions/1/edits").json() == []


@pytest.mark.parametrize("body", [
    {},                      # ningún campo
    {"answer": None},        # null
    {"answer": ""},          # vacío
    {"answer": "   "},       # solo espacios
    {"answer": 5},           # no es texto
    {"source": "otra"},      # campo que no se puede editar
    {"is_active": "yes"},    # no es booleano
], ids=["vacio", "null", "texto-vacio", "solo-espacios", "numero", "campo-desconocido",
        "booleano-invalido"])
def test_invalid_body_is_rejected(client, body):
    assert client.patch("/questions/1", json=body).status_code == 422


@pytest.mark.parametrize("method, path", [
    ("patch", "/questions/999"),
    ("delete", "/questions/999"),
    ("get", "/questions/999/edits"),
])
def test_unknown_question_returns_404(client, method, path):
    kwargs = {"json": {"answer": "x"}} if method == "patch" else {}
    assert getattr(client, method)(path, **kwargs).status_code == 404


# --- Traducción a mano ---

def test_partial_spanish_on_untranslated_question_is_rejected(client):
    r = client.patch("/questions/1", json={"answer_es": "París"})
    assert r.status_code == 422
    assert "5 campos" in r.json()["detail"]
    assert client.get("/questions/1").json()["is_translated"] is False


def test_translate_by_hand(client):
    r = client.patch("/questions/1", json=SPANISH)
    assert r.status_code == 200
    question = r.json()["question"]
    assert question["is_translated"] is True
    assert question["translation_model"] == "manual"
    # El juego ya la muestra en español
    game = client.get("/game/question", params={"category": "geografia", "lang": "es"}).json()
    assert game["lang"] == "es"
    assert game["question"] == SPANISH["question_es"]


def test_edit_one_spanish_field_of_translated_question(client):
    client.patch("/questions/1", json=SPANISH)
    r = client.patch("/questions/1", json={"wrong_3_es": "Londres"})
    assert r.status_code == 200
    assert r.json()["changed_fields"] == ["wrong_3_es"]


def test_repeated_spanish_options_are_rejected(client):
    client.patch("/questions/1", json=SPANISH)
    r = client.patch("/questions/1", json={"answer_es": "Roma"})  # ya es una incorrecta
    assert r.status_code == 422
    assert "español" in r.json()["detail"]


# --- Ocultar y volver a mostrar ---

def test_hide_question(client):
    r = client.delete("/questions/1")
    assert r.status_code == 200
    assert r.json() == {"id": 1, "is_active": False}
    assert client.get("/questions/1").json()["is_active"] is False


def test_hidden_question_is_not_played(client):
    client.delete("/questions/1")
    # Era la única de geografía: ya no hay preguntas para jugar
    assert client.get("/game/question", params={"category": "geografia"}).status_code == 404
    # Sin categoría, solo puede salir la Mona Lisa
    ids = {client.get("/game/question").json()["id"] for _ in range(20)}
    assert ids == {3}


def test_hide_twice_records_once(client):
    client.delete("/questions/1")
    assert client.delete("/questions/1").status_code == 200
    edits = client.get("/questions/1/edits").json()
    assert [(e["field"], e["old_value"], e["new_value"]) for e in edits] == [
        ("is_active", "true", "false")
    ]


def test_show_hidden_question_again(client):
    client.delete("/questions/1")
    r = client.patch("/questions/1", json={"is_active": True})
    assert r.status_code == 200
    assert r.json()["changed_fields"] == ["is_active"]
    game = client.get("/game/question", params={"category": "geografia"}).json()
    assert game["id"] == 1
    fields = [(e["old_value"], e["new_value"]) for e in client.get("/questions/1/edits").json()]
    assert fields == [("true", "false"), ("false", "true")]


@pytest.mark.parametrize("status, expected_ids", [
    ("all", [1, 2, 3]),
    ("active", [2, 3]),
    ("hidden", [1]),
])
def test_list_filters_by_status(client, status, expected_ids):
    client.delete("/questions/1")
    data = client.get("/questions", params={"status": status}).json()
    assert [q["id"] for q in data] == expected_ids


def test_list_rejects_unknown_status(client):
    assert client.get("/questions", params={"status": "otro"}).status_code == 422


def test_category_list_includes_is_active(client):
    client.delete("/questions/1")
    data = client.get("/questions/category/geografia").json()
    assert data[0]["is_active"] is False