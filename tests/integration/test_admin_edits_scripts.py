"""
Exportar las correcciones del admin al CSV y volver a aplicarlas.
Usan la base de prueba y un CSV temporal, sin tocar los archivos reales.

Base de prueba (ver tests/conftest.py):
  id 1: ¿Capital de Francia? -> París
  id 2: ¿Capital de Italia?  -> Roma
  id 3: ¿Quién pintó la Mona Lisa? -> Da Vinci
"""
from typing import Any

import pytest

from app import export_admin_edits, restore_admin_edits
from app.admin_edits import AdminEdit, load_admin_edits, save_admin_edits
from app.models import Question, QuestionEdit
from tests.conftest import TestingSession

FRANCE = ("¿Capital de Francia?", "París")
MONA_LISA = ("¿Quién pintó la Mona Lisa?", "Da Vinci")
SPANISH = {
    "question_es": "¿Cuál es la capital de Francia?",
    "answer_es": "París",
    "wrong_1_es": "Roma",
    "wrong_2_es": "Madrid",
    "wrong_3_es": "Berlín",
}


@pytest.fixture
def edits_file(tmp_path, monkeypatch):
    """CSV temporal en lugar del real, y el script conectado a la base de prueba."""
    path = tmp_path / "admin_edits.csv"
    for script in (export_admin_edits, restore_admin_edits):
        monkeypatch.setattr(script, "EDITS_FILE", path)
        monkeypatch.setattr(script, "SessionLocal", TestingSession)
    return path


def restore(path, edits, save=True):
    """Escribe las correcciones en el CSV temporal y las aplica."""
    save_admin_edits(edits, path)
    restore_admin_edits.main(save)


# --- Exportar ---

def test_exports_final_values(client, edits_file):
    client.patch("/questions/1", json={"answer": "Paris"})
    client.patch("/questions/1", json={"answer": "Paris (Francia)"})  # vale la última
    client.delete("/questions/3")
    export_admin_edits.main()
    assert load_admin_edits(edits_file) == [
        # La pregunta se identifica por su respuesta ORIGINAL ("París")
        AdminEdit(*FRANCE, "answer", "Paris (Francia)"),
        AdminEdit(*MONA_LISA, "is_active", "false"),
    ]


def test_keeps_corrections_made_elsewhere(client, edits_file):
    # Una corrección hecha en otra computadora, que esta base no conoce
    other = AdminEdit("¿Otra pregunta?", "Otra", "answer_es", "Otra respuesta")
    save_admin_edits([other], edits_file)
    client.delete("/questions/3")
    export_admin_edits.main()
    assert load_admin_edits(edits_file) == [other, AdminEdit(*MONA_LISA, "is_active", "false")]


def test_new_value_replaces_the_old_one(client, edits_file):
    save_admin_edits([AdminEdit(*FRANCE, "answer", "Vieja")], edits_file)
    client.patch("/questions/1", json={"answer": "Nueva"})
    export_admin_edits.main()
    assert load_admin_edits(edits_file) == [AdminEdit(*FRANCE, "answer", "Nueva")]


def test_undone_edit_is_removed(client, edits_file):
    # Se exportó un cambio que después el admin deshizo
    save_admin_edits([AdminEdit(*MONA_LISA, "is_active", "false")], edits_file)
    client.delete("/questions/3")
    client.patch("/questions/3", json={"is_active": True})
    export_admin_edits.main()
    assert load_admin_edits(edits_file) == []


def test_without_edits_the_file_stays_the_same(client, edits_file):
    previous = [AdminEdit(*FRANCE, "answer_es", "París")]
    save_admin_edits(previous, edits_file)
    export_admin_edits.main()
    assert load_admin_edits(edits_file) == previous


# --- Restaurar ---

def test_restore_applies_the_corrections(client, edits_file):
    restore(edits_file, [AdminEdit(*FRANCE, "answer", "Paris"), AdminEdit(*MONA_LISA, "is_active", "false")])
    assert client.get("/questions/1").json()["answer"] == "Paris"
    assert client.get("/questions/3").json()["is_active"] is False
    # La Mona Lisa era la única de arte: ya no sale en el juego
    assert client.get("/game/question", params={"category": "arte"}).status_code == 404


def test_restore_records_the_history(client, edits_file):
    restore(edits_file, [AdminEdit(*FRANCE, "answer", "Paris")])
    edits = client.get("/questions/1/edits").json()
    assert [(e["field"], e["old_value"], e["new_value"]) for e in edits] == [
        ("answer", "París", "Paris")
    ]


def test_restore_without_apply_saves_nothing(client, edits_file):
    restore(edits_file, [AdminEdit(*FRANCE, "answer", "Paris")], save=False)
    assert client.get("/questions/1").json()["answer"] == "París"
    assert client.get("/questions/1/edits").json() == []


def test_restore_twice_changes_nothing_the_second_time(client, edits_file):
    restore(edits_file, [AdminEdit(*FRANCE, "answer", "Paris")])
    restore_admin_edits.main(True)
    assert len(client.get("/questions/1/edits").json()) == 1


def test_restore_finds_a_question_already_edited(client, edits_file):
    # En esta base el admin ya había cambiado la respuesta: se la encuentra igual
    client.patch("/questions/1", json={"answer": "Otra"})
    restore(edits_file, [AdminEdit(*FRANCE, "answer", "Paris")])
    assert client.get("/questions/1").json()["answer"] == "Paris"


def test_restore_a_translation_by_hand(client, edits_file):
    restore(edits_file, [AdminEdit(*FRANCE, field, value) for field, value in SPANISH.items()])
    question = client.get("/questions/1").json()
    assert question["is_translated"] is True
    assert question["translation_model"] == "manual"
    assert question["answer_es"] == "París"


def test_restore_skips_invalid_and_unknown_questions(client, edits_file, capsys):
    restore(edits_file, [
        AdminEdit(*FRANCE, "answer", "Opción A"),           # repetiría una incorrecta
        AdminEdit("¿No existe?", "Nada", "answer", "Algo"),  # no está en la base
        AdminEdit(*MONA_LISA, "is_active", "false"),        # válida
    ])
    output = capsys.readouterr().out
    assert "repetidas" in output
    assert "No se encontró" in output
    assert client.get("/questions/1").json()["answer"] == "París"  # no se aplicó
    assert client.get("/questions/3").json()["is_active"] is False  # la válida sí


def test_export_and_restore_after_reloading(client, edits_file):
    # El admin corrige, se exporta...
    client.patch("/questions/1", json={"answer": "Paris"})
    client.delete("/questions/3")
    export_admin_edits.main()

    # ...se vuelve a cargar el dataset (se pierden las correcciones y el historial)...
    with TestingSession() as db:
        db.query(QuestionEdit).delete()
        france: Any = db.get(Question, 1)
        france.answer = "París"
        mona_lisa: Any = db.get(Question, 3)
        mona_lisa.is_active = True
        db.commit()

    # ...y se recuperan con restore_admin_edits
    restore_admin_edits.main(True)
    assert client.get("/questions/1").json()["answer"] == "Paris"
    assert client.get("/questions/3").json()["is_active"] is False