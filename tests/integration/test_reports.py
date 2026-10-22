"""
Reportes de preguntas con errores: el jugador reporta (público, con límite
por IP) y el admin los revisa y los marca como resueltos o descartados.

Base de prueba (ver tests/conftest.py):
  id 1: ¿Capital de Francia? -> París      (categorizada: geografia)
  id 2: ¿Capital de Italia?  -> Roma       (sin categorizar)
  id 3: ¿Quién pintó la Mona Lisa? -> Da Vinci (categorizada: arte)
"""
import pytest

from app.main import REPORTS_PER_MINUTE, report_limiter
from tests.conftest import TEST_API_KEY

REPORT = {
    "question_id": 1,
    "reason": "traduccion",
    "comment": "La traducción no se entiende",
    "lang": "es",
}


@pytest.fixture(autouse=True)
def reset_limiter():
    """Cada test empieza con el contador de reportes en cero."""
    report_limiter.reset()
    yield
    report_limiter.reset()


def report(client, **changes):
    """Manda un reporte (con los cambios indicados respecto de REPORT)."""
    return client.post("/reports", json={**REPORT, **changes})


# --- El jugador reporta ---

def test_player_can_report_without_key(anon_client):
    r = report(anon_client)
    assert r.status_code == 201
    data = r.json()
    # Respuesta corta: no incluye las respuestas de la pregunta
    assert set(data) == {"id", "question_id", "reason", "status", "created_at"}
    assert data["question_id"] == 1
    assert data["status"] == "pendiente"


def test_report_defaults(client):
    client.post("/reports", json={"question_id": 1, "reason": "respuesta_incorrecta"})
    saved = client.get("/reports").json()[0]
    assert saved["lang"] == "es"
    assert saved["comment"] is None


def test_blank_comment_is_saved_as_none(client):
    report(client, comment="   ")
    assert client.get("/reports").json()[0]["comment"] is None


def test_comment_is_trimmed(client):
    report(client, comment="  Dice Pereza  ")
    assert client.get("/reports").json()[0]["comment"] == "Dice Pereza"


def test_other_with_comment_is_accepted(client):
    assert report(client, reason="otro", comment="La imagen no carga").status_code == 201


@pytest.mark.parametrize("changes", [
    {"reason": "otra"},                     # motivo que no existe
    {"reason": None},                       # sin motivo
    {"reason": "otro", "comment": None},    # "otro" necesita comentario
    {"reason": "otro", "comment": "   "},   # ... que no esté vacío
    {"comment": "x" * 501},                 # comentario demasiado largo
    {"lang": "fr"},                         # idioma no disponible
    {"question_id": 0},                     # id inválido
    {"question_id": "1"},                   # id como texto (strict)
    {"ip": "1.2.3.4"},                      # campo de más
], ids=["motivo-inexistente", "sin-motivo", "otro-sin-comentario", "otro-comentario-vacio",
        "comentario-largo", "idioma", "id-cero", "id-texto", "campo-de-mas"])
def test_invalid_report_is_rejected(client, changes):
    assert report(client, **changes).status_code == 422
    assert client.get("/reports", params={"status": "todos"}).json() == []


def test_unknown_question_returns_404(client):
    assert report(client, question_id=999).status_code == 404


def test_hidden_question_cannot_be_reported(client):
    client.delete("/questions/1")
    assert report(client).status_code == 404


# --- Límite por IP ---

def test_rate_limit(client):
    for _ in range(REPORTS_PER_MINUTE):
        assert report(client).status_code == 201
    r = report(client)
    assert r.status_code == 429
    assert 1 <= int(r.headers["Retry-After"]) <= 60
    # Los rechazados no se guardan
    assert len(client.get("/reports", params={"limit": 100}).json()) == REPORTS_PER_MINUTE


def test_failed_attempts_also_count(client):
    # Probar ids al azar (404) también cuenta para el límite
    for _ in range(REPORTS_PER_MINUTE):
        report(client, question_id=999)
    assert report(client).status_code == 429


# --- El admin los revisa ---

def test_list_includes_the_question(client):
    report(client)
    data = client.get("/reports").json()
    assert len(data) == 1
    assert data[0]["reason"] == "traduccion"
    assert data[0]["comment"] == "La traducción no se entiende"
    assert data[0]["question"]["question"] == "¿Capital de Francia?"
    assert data[0]["question"]["answer"] == "París"
    assert data[0]["question"]["is_active"] is True


def test_list_newest_first(client):
    first = report(client).json()["id"]
    second = report(client, question_id=3).json()["id"]
    assert [r["id"] for r in client.get("/reports").json()] == [second, first]


def test_list_filters_by_question(client):
    report(client)
    report(client, question_id=3)
    data = client.get("/reports", params={"question_id": 3}).json()
    assert [r["question_id"] for r in data] == [3]


def test_resolve_report(client):
    report_id = report(client).json()["id"]
    r = client.patch(f"/reports/{report_id}", json={"status": "resuelto"})
    assert r.status_code == 200
    assert r.json()["status"] == "resuelto"
    assert r.json()["resolved_at"] is not None
    # Ya no aparece entre los pendientes (el filtro por defecto)
    assert client.get("/reports").json() == []
    assert len(client.get("/reports", params={"status": "resuelto"}).json()) == 1
    assert len(client.get("/reports", params={"status": "todos"}).json()) == 1


def test_back_to_pending_clears_resolved_at(client):
    report_id = report(client).json()["id"]
    client.patch(f"/reports/{report_id}", json={"status": "descartado"})
    r = client.patch(f"/reports/{report_id}", json={"status": "pendiente"})
    assert r.json()["status"] == "pendiente"
    assert r.json()["resolved_at"] is None


@pytest.mark.parametrize("body", [
    {"status": "cerrado"},
    {"status": None},
    {},
    {"status": "resuelto", "reason": "otro"},
], ids=["estado-inexistente", "null", "vacio", "campo-de-mas"])
def test_invalid_status_change_is_rejected(client, body):
    report_id = report(client).json()["id"]
    assert client.patch(f"/reports/{report_id}", json=body).status_code == 422


def test_unknown_report_returns_404(client):
    assert client.patch("/reports/999", json={"status": "resuelto"}).status_code == 404


def test_list_rejects_unknown_status(client):
    assert client.get("/reports", params={"status": "cerrado"}).status_code == 422


def test_stats(client):
    report(client)
    report(client, question_id=3)
    other = report(client, reason="otro", comment="Algo raro").json()["id"]
    client.patch(f"/reports/{other}", json={"status": "resuelto"})
    assert client.get("/reports/stats").json() == {
        "pendiente": 2,
        "resuelto": 1,
        "descartado": 0,
        "pending_by_reason": {"traduccion": 2},
    }


# --- Sin clave, el jugador no puede ver ni cambiar reportes ---

def test_player_cannot_change_a_report(anon_client):
    report_id = report(anon_client).json()["id"]
    assert anon_client.patch(f"/reports/{report_id}", json={"status": "resuelto"}).status_code == 401
    saved = anon_client.get("/reports", headers={"X-API-Key": TEST_API_KEY}).json()
    assert saved[0]["status"] == "pendiente"