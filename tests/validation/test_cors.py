"""
CORS: el navegador deja que el frontend llame a la API solo desde las
direcciones permitidas (CORS_ORIGINS en el .env).
"""
import pytest

from app.main import CORS_ORIGINS, env_list

ALLOWED = CORS_ORIGINS[0]  # por defecto, http://localhost:5173
OTHER = "https://otro-sitio.example"
VARIABLE = "VARIABLE_DE_PRUEBA"


def preflight(client, origin: str, method: str = "PATCH", headers: str = "content-type,x-api-key"):
    """Pregunta previa que hace el navegador antes de un PATCH con la API key."""
    return client.options("/questions/1", headers={
        "Origin": origin,
        "Access-Control-Request-Method": method,
        "Access-Control-Request-Headers": headers,
    })


# --- Pedidos comunes ---

def test_allowed_origin_can_read_the_response(anon_client):
    r = anon_client.get("/categories", headers={"Origin": ALLOWED})
    assert r.status_code == 200
    assert r.headers["access-control-allow-origin"] == ALLOWED


def test_other_origin_cannot_read_the_response(anon_client):
    # La API responde igual, pero sin el permiso el navegador no deja leerla
    r = anon_client.get("/categories", headers={"Origin": OTHER})
    assert "access-control-allow-origin" not in r.headers


def test_no_cookies(anon_client):
    r = anon_client.get("/categories", headers={"Origin": ALLOWED})
    assert "access-control-allow-credentials" not in r.headers


def test_frontend_can_read_retry_after(anon_client):
    r = anon_client.get("/categories", headers={"Origin": ALLOWED})
    assert "retry-after" in r.headers["access-control-expose-headers"].lower()


def test_errors_also_carry_the_permission(anon_client):
    # Sin esto, el frontend no podría leer un 401 y mostraría un error genérico
    r = anon_client.get("/questions", headers={"Origin": ALLOWED})
    assert r.status_code == 401
    assert r.headers["access-control-allow-origin"] == ALLOWED


# --- Pregunta previa (preflight) ---

def test_preflight_allows_patch_with_the_api_key(anon_client):
    r = preflight(anon_client, ALLOWED)
    assert r.status_code == 200
    assert r.headers["access-control-allow-origin"] == ALLOWED
    assert "PATCH" in r.headers["access-control-allow-methods"]
    assert "x-api-key" in r.headers["access-control-allow-headers"].lower()


def test_preflight_from_other_origin_is_rejected(anon_client):
    assert preflight(anon_client, OTHER).status_code == 400


def test_preflight_with_other_headers_is_rejected(anon_client):
    assert preflight(anon_client, ALLOWED, headers="x-otro-encabezado").status_code == 400


def test_preflight_with_other_methods_is_rejected(anon_client):
    assert preflight(anon_client, ALLOWED, method="TRACE").status_code == 400


# --- env_list (lee CORS_ORIGINS) ---

@pytest.mark.parametrize("value, expected", [
    (None, ("x",)),                                   # no existe: valor por defecto
    ("", ("x",)),                                     # vacía: también
    (" , ", ("x",)),                                  # solo comas y espacios: también
    ("http://a:5173", ("http://a:5173",)),
    ("http://a:5173/, https://b.com ,", ("http://a:5173", "https://b.com")),  # sin barra ni espacios
])
def test_env_list(monkeypatch, value, expected):
    if value is None:
        monkeypatch.delenv(VARIABLE, raising=False)
    else:
        monkeypatch.setenv(VARIABLE, value)
    assert env_list(VARIABLE, default=("x",)) == expected