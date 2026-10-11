import pytest

from app.categories import CATEGORIES
from app.human_review import ask_human_for_category, confirm_ai_suggestion


def feed(monkeypatch, *answers: str) -> None:
    """Simula lo que el usuario escribe en la terminal, en orden."""
    it = iter(answers)
    monkeypatch.setattr("builtins.input", lambda _prompt="": next(it))


# --- confirm_ai_suggestion ---

@pytest.mark.parametrize("answer", ["", "s", "S", "si", "sí"])
def test_confirm_accepts(monkeypatch, answer):
    feed(monkeypatch, answer)
    assert confirm_ai_suggestion("arte", 0.5) is True


@pytest.mark.parametrize("answer", ["n", "N", "no"])
def test_confirm_rejects(monkeypatch, answer):
    feed(monkeypatch, answer)
    assert confirm_ai_suggestion("arte", 0.5) is False


def test_confirm_asks_again_after_invalid_answer(monkeypatch):
    feed(monkeypatch, "quizás", "s")
    assert confirm_ai_suggestion("arte", 0.5) is True


# --- ask_human_for_category ---

def test_choose_by_number(monkeypatch):
    feed(monkeypatch, "4")
    assert ask_human_for_category(CATEGORIES) == CATEGORIES[3]["name"]


def test_options_follow_the_scores_order(monkeypatch):
    scores = {"historia": 0.5, "arte": 0.3, "geografia": 0.1,
              "ciencia": 0.05, "entretenimiento": 0.03, "deportes": 0.02}
    feed(monkeypatch, "2")
    assert ask_human_for_category(CATEGORIES, scores) == "arte"


def test_skip_returns_none(monkeypatch):
    feed(monkeypatch, "S")
    assert ask_human_for_category(CATEGORIES) is None


def test_asks_again_after_invalid_answers(monkeypatch):
    feed(monkeypatch, "0", "9", "abc", "1")
    assert ask_human_for_category(CATEGORIES) == CATEGORIES[0]["name"]