"""Funciones auxiliares de la revisión humana de las traducciones (sin base de datos)."""
import pytest

from app.review_translations import choose_sample, parse_rating, summarize


@pytest.mark.parametrize("text, expected", [
    ("b", "bien"),
    ("  M ", "menor"),  # sin distinguir mayúsculas ni espacios
    ("error", "error"),  # alcanza con la primera letra
    ("s", ""),  # saltear
    ("x", None),  # no válida: se vuelve a preguntar
    ("", None),
])
def test_parse_rating(text, expected):
    assert parse_rating(text) == expected


def test_same_seed_gives_the_same_sample():
    ids = list(range(1, 101))
    assert choose_sample(ids, 10, set(), seed=42) == choose_sample(ids, 10, set(), seed=42)
    assert choose_sample(ids, 10, set(), seed=42) != choose_sample(ids, 10, set(), seed=7)


def test_sample_does_not_depend_on_the_order_from_the_database():
    ids = list(range(1, 101))
    assert choose_sample(ids, 10, set(), 42) == choose_sample(ids[::-1], 10, set(), 42)


def test_resuming_continues_with_the_same_sample():
    ids = list(range(1, 101))
    first = choose_sample(ids, 10, set(), seed=42)
    # Se revisaron las 4 primeras y se cortó: las siguientes son las que faltaban
    assert choose_sample(ids, 6, set(first[:4]), seed=42) == first[4:]


def test_sample_smaller_than_requested_when_few_are_left():
    assert sorted(choose_sample([1, 2, 3], 10, {2}, seed=42)) == [1, 3]


def test_summarize_ignores_skipped():
    reviews = [{"rating": r} for r in ["bien", "bien", "menor", "error", ""]]
    assert summarize(reviews) == {"bien": 2, "menor": 1, "error": 1}