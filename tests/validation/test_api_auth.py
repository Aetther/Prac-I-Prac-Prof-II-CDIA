"""Autenticación: solo se pueden modificar datos con la API key correcta."""
from tests.conftest import TEST_API_KEY

NEW_QUESTION = {
    "question": "¿Cuál es la capital de Chaco?",
    "answer": "Resistencia",
    "wrong_1": "Corrientes",
    "wrong_2": "Formosa",
    "wrong_3": "Posadas",
    "category": "Geografía",
}


def test_post_without_key_is_rejected(anon_client):
    r = anon_client.post("/questions", json=NEW_QUESTION)
    assert r.status_code == 401


def test_post_with_wrong_key_is_rejected(anon_client):
    r = anon_client.post(
        "/questions", json=NEW_QUESTION, headers={"X-API-Key": "clave-incorrecta"}
    )
    assert r.status_code == 401


def test_post_with_correct_key_works(anon_client):
    r = anon_client.post(
        "/questions", json=NEW_QUESTION, headers={"X-API-Key": TEST_API_KEY}
    )
    assert r.status_code == 201


def test_put_without_key_does_not_change_anything(anon_client):
    r = anon_client.put("/categorizations/1", json={"category_name": "historia"})
    assert r.status_code == 401

    # La categorización 1 (Francia) sigue igual que antes
    rows = anon_client.get("/questions/category/geografia").json()
    assert rows[0]["categorization_id"] == 1
    assert rows[0]["is_automatic"] is True


def test_reading_does_not_need_key(anon_client):
    assert anon_client.get("/questions").status_code == 200
    assert anon_client.get("/categories/stats").status_code == 200


def test_writing_is_disabled_if_server_has_no_key(client, monkeypatch):
    monkeypatch.delenv("API_KEY")
    r = client.post("/questions", json=NEW_QUESTION)
    assert r.status_code == 503