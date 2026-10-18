"""
Autenticación: el juego y las estadísticas son públicos; la administración
(ver respuestas, crear y corregir) requiere la API key correcta.
"""
import pytest

from tests.conftest import TEST_API_KEY

NEW_QUESTION = {
    "question": "¿Cuál es la capital de Chaco?",
    "answer": "Resistencia",
    "wrong_1": "Corrientes",
    "wrong_2": "Formosa",
    "wrong_3": "Posadas",
    "category": "Geografía",
}


# --- Escritura ---

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
    rows = anon_client.get(
        "/questions/category/geografia", headers={"X-API-Key": TEST_API_KEY}
    ).json()
    assert rows[0]["categorization_id"] == 1
    assert rows[0]["is_automatic"] is True


# --- Lectura ---

@pytest.mark.parametrize("path", [
    "/game/question",
    "/stats",
    "/categories",
    "/categories/stats",
    "/translation/stats",
])
def test_public_endpoints_do_not_need_key(anon_client, path):
    assert anon_client.get(path).status_code == 200


@pytest.mark.parametrize("path", [
    "/questions",
    "/questions/1",
    "/questions/category/arte",
])
def test_admin_endpoints_need_key(anon_client, path):
    # Muestran la respuesta correcta: sin clave, no
    assert anon_client.get(path).status_code == 401
    assert anon_client.get(path, headers={"X-API-Key": TEST_API_KEY}).status_code == 200


# --- Servidor sin clave configurada ---

def test_admin_is_disabled_if_server_has_no_key(client, monkeypatch):
    monkeypatch.delenv("API_KEY")
    r = client.post("/questions", json=NEW_QUESTION)
    assert r.status_code == 503