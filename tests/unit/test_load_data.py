import pandas as pd

from app.load_data import build_rows, clean


def make_df(records: list[dict]) -> pd.DataFrame:
    return pd.DataFrame(records)


def valid_record(**changes) -> dict:
    record = {
        "category": "geography",
        "question": "What is the capital of France?",
        "choices": ["Paris", "Rome", "Madrid", "Berlin"],
        "answer": "Paris",
    }
    record.update(changes)
    return record


# --- clean ---

def test_clean_repairs_encoding_errors():
    assert clean("Queenâ\x80\x99s bedroom") == "Queen's bedroom"


def test_clean_strips_spaces():
    assert clean("  Paris  ") == "Paris"


def test_clean_leaves_correct_text_unchanged():
    assert clean("¿Capital de Francia?") == "¿Capital de Francia?"


# --- build_rows ---

def test_valid_question_is_kept():
    rows = build_rows(make_df([valid_record()]))
    assert len(rows) == 1
    row = rows[0]
    assert row["answer"] == "Paris"
    assert {row["wrong_1"], row["wrong_2"], row["wrong_3"]} == {"Rome", "Madrid", "Berlin"}


def test_category_is_mapped():
    rows = build_rows(make_df([valid_record(category="world")]))
    assert rows[0]["category"] == "Geografía"


def test_unmapped_category_is_discarded():
    assert build_rows(make_df([valid_record(category="celebrities")])) == []


def test_true_false_question_is_discarded():
    record = valid_record(choices=["True", "False"], answer="True")
    assert build_rows(make_df([record])) == []


def test_answer_not_in_choices_is_discarded():
    assert build_rows(make_df([valid_record(answer="London")])) == []


def test_repeated_wrong_options_are_discarded():
    # Quedan solo 2 incorrectas distintas: no sirve para el juego
    record = valid_record(choices=["Paris", "Rome", "Rome", "Berlin"])
    assert build_rows(make_df([record])) == []


def test_text_is_repaired_when_building_rows():
    record = valid_record(question="Which is the Queenâ\x80\x99s castle?")
    rows = build_rows(make_df([record]))
    assert rows[0]["question"] == "Which is the Queen's castle?"

def test_duplicated_question_is_kept_once():
    rows = build_rows(make_df([valid_record(), valid_record(category="world")]))
    assert len(rows) == 1


def test_disguised_true_false_question_is_discarded():
    record = valid_record(
        choices=["True", "False", "Some cut text", "Another fragment"],
        answer="True",
    )
    assert build_rows(make_df([record])) == []