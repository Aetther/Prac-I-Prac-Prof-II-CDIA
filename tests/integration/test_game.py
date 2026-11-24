"""
Tests del juego: las preguntas no revelan la respuesta hasta que se responde,
y se pueden jugar en español o en inglés.

Base de prueba (ver tests/conftest.py):
  id 1: ¿Capital de Francia? -> París      (categorizada: geografia)
  id 2: ¿Capital de Italia?  -> Roma       (sin categorizar)
  id 3: ¿Quién pintó la Mona Lisa? -> Da Vinci (categorizada: arte)
Ninguna está traducida, salvo en los tests que usan el fixture `translated`.
"""
import time

import pytest

from app.answer_token import TOKEN_TTL_SECONDS, issue_token
from app.models import Categorization, Question

TRANSLATION = {
    "question_es": "Pregunta traducida",
    "answer_es": "Respuesta traducida",
    "wrong_1_es": "Incorrecta 1",
    "wrong_2_es": "Incorrecta 2",
    "wrong_3_es": "Incorrecta 3",
}


@pytest.fixture
def translated(seeded_db):
    """Marca la pregunta 1 (Francia) como traducida, con textos reconocibles."""
    france = seeded_db.get(Question, 1)
    for field, value in TRANSLATION.items():
        setattr(france, field, value)
    france.is_translated = True
    france.translation_model = "Helsinki-NLP/opus-mt-en-es"
    seeded_db.commit()
    return france


def body(question_id, answer):
    """Cuerpo de POST /game/answer con un token válido para esa pregunta."""
    return {
        "question_id": question_id,
        "answer": answer,
        "token": issue_token(question_id),
    }


# --- GET /game/question ---

def test_game_question_does_not_reveal_answer(anon_client):
    r = anon_client.get("/game/question")
    assert r.status_code == 200
    data = r.json()
    assert set(data) == {"id", "question", "category", "options", "lang", "token"}
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


# --- Idiomas en GET /game/question ---

def test_game_question_in_spanish(anon_client, translated):
    data = anon_client.get(
        "/game/question", params={"category": "geografia", "lang": "es"}
    ).json()
    assert data["lang"] == "es"
    assert data["question"] == TRANSLATION["question_es"]
    assert sorted(data["options"]) == sorted(
        [TRANSLATION[f] for f in ("answer_es", "wrong_1_es", "wrong_2_es", "wrong_3_es")]
    )


def test_game_question_spanish_is_the_default(anon_client, translated):
    data = anon_client.get("/game/question", params={"category": "geografia"}).json()
    assert data["lang"] == "es"


def test_game_question_in_english(anon_client, translated):
    data = anon_client.get(
        "/game/question", params={"category": "geografia", "lang": "en"}
    ).json()
    assert data["lang"] == "en"
    assert data["question"] == "¿Capital de Francia?"  # el texto original


def test_untranslated_question_falls_back_to_english(anon_client):
    # La Mona Lisa no tiene traducción: aunque se pida español, viene el original
    data = anon_client.get("/game/question", params={"category": "arte", "lang": "es"}).json()
    assert data["lang"] == "en"
    assert data["question"] == "¿Quién pintó la Mona Lisa?"


def test_game_question_invalid_lang(anon_client):
    r = anon_client.get("/game/question", params={"lang": "fr"})
    assert r.status_code == 422


# --- POST /game/answer ---

def test_game_answer_correct(anon_client):
    r = anon_client.post("/game/answer", json=body(1, "París"))
    assert r.status_code == 200
    assert r.json() == {"correct": True, "correct_answer": "París"}


def test_game_answer_wrong_reveals_correct_answer(anon_client):
    r = anon_client.post("/game/answer", json=body(1, "Opción A"))
    assert r.status_code == 200
    assert r.json() == {"correct": False, "correct_answer": "París"}


def test_game_answer_ignores_case_and_spaces(anon_client):
    r = anon_client.post("/game/answer", json=body(1, "  parís "))
    assert r.json()["correct"] is True


def test_game_answer_unknown_question(anon_client):
    r = anon_client.post("/game/answer", json=body(999, "París"))
    assert r.status_code == 404


@pytest.mark.parametrize("data", [
    {"question_id": 0, "answer": "París", "token": "x"},
    {"question_id": "1", "answer": "París", "token": "x"},
    {"question_id": 1, "token": "x"},
    {"question_id": 1, "answer": "París"},
    {"question_id": 1, "answer": "París", "token": ""},
    {"question_id": 1, "answer": "París", "token": "x" * 201},
    {"question_id": 1, "answer": "París", "token": "x", "extra": True},
], ids=[
    "id-cero", "id-texto", "sin-respuesta", "sin-token", "token-vacio",
    "token-largo", "campo-extra",
])
def test_game_answer_invalid_body(anon_client, data):
    r = anon_client.post("/game/answer", json=data)
    assert r.status_code == 422


# --- Token de respuesta ---

def test_game_answer_with_token_from_game_question(anon_client):
    """El recorrido real: el token que da GET /game/question sirve para responder."""
    question = anon_client.get("/game/question").json()
    r = anon_client.post("/game/answer", json={
        "question_id": question["id"],
        "answer": question["options"][0],
        "token": question["token"],
    })
    assert r.status_code == 200


def test_game_answer_rejects_forged_token(anon_client):
    data = {**body(1, "París"), "token": "9999999999.firma-inventada"}
    r = anon_client.post("/game/answer", json=data)
    assert r.status_code == 403


def test_game_answer_rejects_token_of_another_question(anon_client):
    """Un token de la pregunta 3 no sirve para ver la respuesta de la 1."""
    data = {**body(1, "París"), "token": issue_token(3)}
    r = anon_client.post("/game/answer", json=data)
    assert r.status_code == 403


def test_game_answer_rejects_expired_token(anon_client):
    old = issue_token(1, now=time.time() - TOKEN_TTL_SECONDS - 1)
    r = anon_client.post("/game/answer", json={**body(1, "París"), "token": old})
    assert r.status_code == 403


def test_game_answer_hidden_question(anon_client, seeded_db):
    """Una pregunta oculta no revela su respuesta, aunque el token sea válido."""
    france = seeded_db.get(Question, 1)
    france.is_active = False
    seeded_db.commit()
    r = anon_client.post("/game/answer", json=body(1, "París"))
    assert r.status_code == 404


# --- Idiomas en POST /game/answer ---

@pytest.mark.parametrize("answer", ["París", "Respuesta traducida"], ids=["en", "es"])
def test_game_answer_accepts_both_languages(anon_client, translated, answer):
    r = anon_client.post("/game/answer", json=body(1, answer))
    assert r.json()["correct"] is True


@pytest.mark.parametrize("lang, expected", [
    ("es", "Respuesta traducida"),
    ("en", "París"),
])
def test_game_answer_reveals_answer_in_requested_language(
    anon_client, translated, lang, expected
):
    r = anon_client.post(
        "/game/answer",
        params={"lang": lang},
        json=body(1, "Incorrecta 1"),
    )
    assert r.json() == {"correct": False, "correct_answer": expected}


def test_game_answer_invalid_lang(anon_client):
    r = anon_client.post(
        "/game/answer", params={"lang": "fr"}, json=body(1, "París")
    )
    assert r.status_code == 422


# --- GET /translation/stats ---

def test_translation_stats(anon_client, translated):
    r = anon_client.get("/translation/stats")
    assert r.status_code == 200
    assert r.json() == {
        "total_questions": 3,
        "translated": 1,
        "untranslated": 2,
        "percentage_translated": 33.33,
        "models_used": ["Helsinki-NLP/opus-mt-en-es"],
    }


def test_translation_stats_without_translations(anon_client):
    data = anon_client.get("/translation/stats").json()
    assert data["translated"] == 0
    assert data["percentage_translated"] == 0.0
    assert data["models_used"] == []