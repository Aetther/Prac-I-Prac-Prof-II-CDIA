"""
Tests del juego: las preguntas no revelan la respuesta hasta que se responde,
y se pueden jugar en español o en inglés.

Base de prueba (ver tests/conftest.py):
  id 1: ¿Capital de Francia? -> París      (categorizada: geografia)
  id 2: ¿Capital de Italia?  -> Roma       (sin categorizar)
  id 3: ¿Quién pintó la Mona Lisa? -> Da Vinci (categorizada: arte)
Ninguna está traducida, salvo en los tests que usan el fixture `translated`.
"""
import pytest

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


# --- GET /game/question ---

def test_game_question_does_not_reveal_answer(anon_client):
    r = anon_client.get("/game/question")
    assert r.status_code == 200
    data = r.json()
    assert set(data) == {"id", "question", "category", "options", "lang"}
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


# --- Idiomas en POST /game/answer ---

@pytest.mark.parametrize("answer", ["París", "Respuesta traducida"], ids=["en", "es"])
def test_game_answer_accepts_both_languages(anon_client, translated, answer):
    r = anon_client.post("/game/answer", json={"question_id": 1, "answer": answer})
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
        json={"question_id": 1, "answer": "Incorrecta 1"},
    )
    assert r.json() == {"correct": False, "correct_answer": expected}


def test_game_answer_invalid_lang(anon_client):
    r = anon_client.post(
        "/game/answer", params={"lang": "fr"}, json={"question_id": 1, "answer": "París"}
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