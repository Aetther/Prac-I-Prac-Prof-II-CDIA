import pytest

# classifier.py importa transformers y torch: si no están instalados
# (grupo de dependencias de IA), estos tests se saltean en lugar de fallar.
pytest.importorskip("transformers")

from app.classifier import build_input_text  # noqa: E402


def test_question_only():
    assert build_input_text("Who wrote Hamlet?") == "Who wrote Hamlet?"


def test_question_with_answer():
    assert (
        build_input_text("Who wrote Hamlet?", "Shakespeare")
        == "Who wrote Hamlet? Answer: Shakespeare"
    )


def test_empty_answer_is_ignored():
    assert build_input_text("Who wrote Hamlet?", "") == "Who wrote Hamlet?"