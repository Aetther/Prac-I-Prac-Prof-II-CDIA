"""
Robustez de la API: códigos de estado correctos, documentación de las
respuestas posibles y configuración de /docs.
"""
import pytest

from app.main import app, env_flag

FLAG = "VARIABLE_DE_PRUEBA"


# --- 404 cuando algo no existe ---

def test_question_by_id(client):
    r = client.get("/questions/1")
    assert r.status_code == 200
    assert r.json()["answer"] == "París"


def test_question_not_found_returns_404(client):
    r = client.get("/questions/999")
    assert r.status_code == 404
    assert r.json()["detail"] == "Pregunta no encontrada"


# --- env_flag (lee ENABLE_DOCS y similares) ---

@pytest.mark.parametrize("value, expected", [
    (None, True),       # no existe: usa el valor por defecto
    ("", True),         # vacía: también usa el valor por defecto
    ("true", True),
    ("1", True),
    ("false", False),
    ("FALSE", False),   # sin distinguir mayúsculas
    (" off ", False),   # ignora espacios
    ("0", False),
    ("no", False),
])
def test_env_flag(monkeypatch, value, expected):
    if value is None:
        monkeypatch.delenv(FLAG, raising=False)
    else:
        monkeypatch.setenv(FLAG, value)
    assert env_flag(FLAG) is expected


def test_env_flag_default_false(monkeypatch):
    monkeypatch.delenv(FLAG, raising=False)
    assert env_flag(FLAG, default=False) is False


# --- Respuestas documentadas en /docs ---

@pytest.mark.parametrize("path, method", [
    ("/questions", "get"),
    ("/questions/{question_id}", "get"),
    ("/questions/category/{category_name}", "get"),
    ("/questions", "post"),
    ("/questions/{question_id}", "patch"),
    ("/questions/{question_id}", "delete"),
    ("/questions/{question_id}/edits", "get"),
    ("/categorizations/{categorization_id}", "put"),
])
def test_admin_endpoints_document_401_and_503(path, method):
    responses = app.openapi()["paths"][path][method]["responses"]
    assert "401" in responses
    assert "503" in responses


def test_game_endpoints_do_not_document_401():
    # El juego es público: no pide clave, así que no puede responder 401
    responses = app.openapi()["paths"]["/game/question"]["get"]["responses"]
    assert "401" not in responses
    assert "404" in responses