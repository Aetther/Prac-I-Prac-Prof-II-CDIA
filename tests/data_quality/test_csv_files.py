"""Calidad de los CSV del repositorio (no necesitan base de datos)."""
import csv
from collections import Counter

import pytest

from app.categories import get_category_names
from app.export_training import FIELDS as TRAINING_FIELDS
from app.export_training import MIN_PER_CATEGORY, OUTPUT_FILE as TRAINING_FILE
from app.review_automatic import FIELDS as REVIEW_FIELDS
from app.review_automatic import REVIEW_FILE


def read_csv(path) -> tuple[list[str], list[dict[str, str]]]:
    if not path.exists():
        pytest.skip(f"No existe {path}")
    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return list(reader.fieldnames or []), list(reader)


# --- training_data.csv ---

def test_training_data_has_expected_columns():
    columns, _ = read_csv(TRAINING_FILE)
    assert columns == TRAINING_FIELDS


def test_training_data_values_are_valid():
    _, rows = read_csv(TRAINING_FILE)
    for row in rows:
        assert row["category_name"] in get_category_names()
        assert row["source"] in {"manual", "automatica_verificada"}
        assert 0.0 <= float(row["confidence_score"]) <= 1.0
        assert row["question"].strip() and row["answer"].strip()


def test_training_data_has_no_duplicates():
    _, rows = read_csv(TRAINING_FILE)
    pairs = [(r["question"], r["answer"]) for r in rows]
    assert len(pairs) == len(set(pairs))


def test_training_data_has_enough_examples_per_category():
    _, rows = read_csv(TRAINING_FILE)
    counts = Counter(r["category_name"] for r in rows)
    for name in get_category_names():
        assert counts[name] >= MIN_PER_CATEGORY, f"{name}: {counts[name]} ejemplos"


# --- precision_review.csv ---

def test_precision_review_has_expected_columns():
    columns, _ = read_csv(REVIEW_FILE)
    assert columns == REVIEW_FIELDS


def test_precision_review_is_consistent():
    _, rows = read_csv(REVIEW_FILE)
    for row in rows:
        assert row["is_correct"] in {"0", "1", ""}
        if row["is_correct"] == "1":
            # Si la IA acertó, la categoría humana es la misma que la de la IA
            assert row["human_category"] == row["ai_category"]
        if row["is_correct"] == "0":
            assert row["human_category"] != row["ai_category"]