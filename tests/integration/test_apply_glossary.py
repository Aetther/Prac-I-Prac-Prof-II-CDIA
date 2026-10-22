"""
El glosario sobre la base de prueba, y su relación con las ediciones del admin.

Base de prueba (ver tests/conftest.py), acá con la pregunta 1 traducida:
  id 1: ¿Capital de Francia? -> París (opciones: Opción A, B y C)
"""
from typing import Any

import pytest

from app import apply_glossary
from app.glossary import Correction
from app.models import Question
from tests.conftest import TestingSession

# La pregunta en español termina en punto: la regla de puntuación la corrige
SPANISH = {
    "question_es": "¿Cuál es la capital de Francia.",
    "answer_es": "Paris",
    "wrong_1_es": "Opción A",
    "wrong_2_es": "Opción B",
    "wrong_3_es": "Opción C",
}
# En la base de prueba la respuesta en "inglés" es "París"
FIX_ANSWER = Correction(1, "París", "París (Francia)")


@pytest.fixture
def glossary(seeded_db, monkeypatch):
    """Traduce la pregunta 1 y conecta el script a la base de prueba."""
    with TestingSession() as db:
        france: Any = db.get(Question, 1)
        for field, value in SPANISH.items():
            setattr(france, field, value)
        france.is_translated = True
        db.commit()
    monkeypatch.setattr(apply_glossary, "SessionLocal", TestingSession)

    def run(corrections, save=True):
        monkeypatch.setattr(apply_glossary, "load_corrections", lambda: corrections)
        apply_glossary.apply_glossary(save)

    return run


def spanish(question_id: int = 1) -> dict[str, Any]:
    with TestingSession() as db:
        question: Any = db.get(Question, question_id)
        return {field: getattr(question, field) for field in SPANISH}


def test_applies_punctuation_and_corrections(glossary):
    glossary([FIX_ANSWER])
    assert spanish()["question_es"] == "¿Cuál es la capital de Francia?"
    assert spanish()["answer_es"] == "París (Francia)"


def test_respects_what_the_admin_edited(client, glossary, capsys):
    # El admin dejó la pregunta y la respuesta como las quiere
    response = client.patch("/questions/1", json={
        "question_es": "¿Capital de Francia.",
        "answer_es": "París, Francia",
    })
    assert response.status_code == 200
    glossary([FIX_ANSWER])
    assert spanish()["question_es"] == "¿Capital de Francia."
    assert spanish()["answer_es"] == "París, Francia"
    assert "las editó el admin: 2" in capsys.readouterr().out


def test_admin_changed_the_english_option(client, glossary, capsys):
    # La corrección apunta a "París", que ya no existe en inglés: no es un
    # problema, porque la cambió el admin. Lo demás se guarda igual.
    assert client.patch("/questions/1", json={"answer": "Paris"}).status_code == 200
    glossary([FIX_ANSWER])
    output = capsys.readouterr().out
    assert "ninguna opción" not in output
    assert "Cambios guardados" in output
    assert spanish()["question_es"] == "¿Cuál es la capital de Francia?"
    assert spanish()["answer_es"] == "Paris"


def test_unknown_option_still_stops_everything(glossary, capsys):
    glossary([Correction(1, "No existe", "Nada")])
    assert "ninguna opción es 'No existe'" in capsys.readouterr().out
    assert spanish()["question_es"] == "¿Cuál es la capital de Francia."  # no se guardó nada