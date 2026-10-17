"""
Tests del juego: las preguntas no revelan la respuesta hasta que se responde.

Base de prueba (ver tests/conftest.py):
  id 1: ¿Capital de Francia? -> París      (categorizada: geografia)
  id 2: ¿Capital de Italia?  -> Roma       (sin categorizar)
  id 3: ¿Quién pintó la Mona Lisa? -> Da Vinci (categorizada: arte)
"""
import pytest

from app.models import Categorization


# --- GET /game/question ---

def test_game_question_does_not_reveal_answer(anon_client):
    r = anon_client.get("/game/question")
    assert r.status_code == 200
    data = r.json()
    assert set(data) == {"id", "question", "category", "options"}
    assert "answer" not in data


def test_game_question_has_all_four_options(anon_client):
    data = anon_client.get("/game/question", params={"category": "geografia"}).json()
    assert data["id"] == 1
    assert sorted(data["options"]) == sorted(["París", "Opción A", "Opción B", "Opción C"])


def test_game_question_filters_by_category(anon_client):
    data = anon_client.get("/game/question", params={"category": "ARTE"}).json()
    assert data["id"] == 3
    assert data["category"] == "arte"


def test_game_question_only_uses_categorized_questions(anon_client):
    # Italia (id 2) no está categorizada: nunca tiene que salir
    ids = {anon_client.get("/game/question").json()["id"] for _ in range(30)}
    assert ids <= {1, 3}


def test_game_question_unknown_category(anon_client):
    r = anon_client.get("/game/question", params={"category": "cocina"})
    assert r.status_code == 404


def test_game_question_without_categorized_questions(anon_client, seeded_db):
    seeded_db.query(Categorization).delete()
    seeded_db.commit()
    r = anon_client.get("/game/question")
    assert r.status_code == 404


# --- POST /game/answer ---

def test_game_answer_correct(anon_client):
    r = anon_client.post("/game/answer", json={"question_id": 1, "answer": "París"})
    assert r.status_code == 200
    assert r.json() == {"correct": True, "correct_answer": "París"}


def test_game_answer_wrong_reveals_correct_answer(anon_client):
    r = anon_client.post("/game/answer", json={"question_id": 1, "answer": "Opción A"})
    assert r.status_code == 200
    assert r.json() == {"correct": False, "correct_answer": "París"}


def test_game_answer_ignores_case_and_spaces(anon_client):
    r = anon_client.post("/game/answer", json={"question_id": 1, "answer": "  parís "})
    assert r.json()["correct"] is True


def test_game_answer_unknown_question(anon_client):
    r = anon_client.post("/game/answer", json={"question_id": 999, "answer": "París"})
    assert r.status_code == 404


@pytest.mark.parametrize("body", [
    {"question_id": 0, "answer": "París"},
    {"question_id": "1", "answer": "París"},
    {"question_id": 1},
    {"question_id": 1, "answer": "París", "extra": True},
], ids=["id-cero", "id-texto", "sin-respuesta", "campo-extra"])
def test_game_answer_invalid_body(anon_client, body):
    r = anon_client.post("/game/answer", json=body)
    assert r.status_code == 422