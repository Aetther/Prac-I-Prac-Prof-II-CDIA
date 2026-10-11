"""
Tests de integración de restore_decisions: CSV + base de datos.
Usan la base de prueba y un CSV temporal, sin tocar los archivos reales.
"""
import csv

import pytest

from app import restore_decisions
from app.models import Categorization
from tests.conftest import TestingSession, make_question

FIELDS = ["question_id", "question", "answer", "category_name", "confidence_score", "source"]


def write_csv(path, rows: list[dict]) -> None:
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)


def decision(question: str, answer: str, category: str, source: str = "manual") -> dict:
    return {
        "question_id": 999,  # a propósito: el id del CSV no debe usarse
        "question": question,
        "answer": answer,
        "category_name": category,
        "confidence_score": "0.4000",
        "source": source,
    }


@pytest.fixture
def csv_path(db_session, tmp_path, monkeypatch):
    """Base con 2 preguntas y un CSV temporal en lugar del real."""
    db_session.add_all([
        make_question("¿Capital de Francia?", "París", "Geografía"),
        make_question("¿Quién pintó la Mona Lisa?", "Da Vinci", "Arte"),
    ])
    db_session.commit()

    path = tmp_path / "training_data.csv"
    monkeypatch.setattr(restore_decisions, "TRAINING_FILE", path)
    monkeypatch.setattr(restore_decisions, "SessionLocal", TestingSession)
    return path


def categorizations(db_session) -> list:
    db_session.expire_all()  # releer de la base, no de la memoria de la sesión
    return db_session.query(Categorization).all()


def test_restores_manual_decision_by_text(csv_path, db_session):
    write_csv(csv_path, [decision("¿Capital de Francia?", "París", "geografia")])
    restore_decisions.main()

    result = categorizations(db_session)
    assert len(result) == 1
    assert result[0].category_name == "geografia"
    assert result[0].is_automatic is False
    assert result[0].confidence_score == pytest.approx(0.4)


def test_verified_decision_is_restored_as_automatic(csv_path, db_session):
    write_csv(csv_path, [
        decision("¿Capital de Francia?", "París", "geografia", source="automatica_verificada"),
    ])
    restore_decisions.main()
    assert categorizations(db_session)[0].is_automatic is True


def test_running_twice_does_not_duplicate(csv_path, db_session):
    write_csv(csv_path, [decision("¿Capital de Francia?", "París", "geografia")])
    restore_decisions.main()
    restore_decisions.main()
    assert len(categorizations(db_session)) == 1


def test_existing_categorization_is_updated(csv_path, db_session):
    # La IA había puesto la Mona Lisa en Historia
    mona_lisa_id = 2
    db_session.add(Categorization(question_id=mona_lisa_id, category_name="historia",
                                  confidence_score=0.6, is_automatic=True))
    db_session.commit()

    write_csv(csv_path, [decision("¿Quién pintó la Mona Lisa?", "Da Vinci", "arte")])
    restore_decisions.main()

    result = categorizations(db_session)
    assert len(result) == 1
    assert result[0].category_name == "arte"
    assert result[0].is_automatic is False


def test_unknown_question_is_reported(csv_path, db_session, capsys):
    write_csv(csv_path, [decision("¿Pregunta que no existe?", "Nada", "arte")])
    restore_decisions.main()

    assert categorizations(db_session) == []
    assert "no encontrada" in capsys.readouterr().out


def test_missing_csv_does_not_fail(csv_path, capsys):
    restore_decisions.main()  # el CSV temporal todavía no existe
    assert "No existe" in capsys.readouterr().out