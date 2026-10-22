"""Correcciones del admin guardadas en el repositorio (sin base de datos)."""
import pytest

from app.admin_edits import (
    AdminEdit,
    EditRecord,
    check_changes,
    edited_keys,
    load_admin_edits,
    merge_edits,
    parse_value,
    save_admin_edits,
    summarize_edits,
)

# Pregunta 1 tal como está ahora en la base
CURRENT = {1: ("Which animal does not hibernate?", "Sloth")}


def summarize(*records):
    """Resume una lista de (campo, anterior, nuevo) de la pregunta 1."""
    history = [EditRecord(1, field, old, new) for field, old, new in records]
    return summarize_edits(history, CURRENT)


# --- Resumir el historial ---

def test_final_value_of_each_field():
    edits = summarize(
        ("answer_es", "Pereza", "Perezos"),
        ("answer_es", "Perezos", "Perezoso"),  # se corrigió dos veces: vale la última
    )
    assert edits == [
        AdminEdit("Which animal does not hibernate?", "Sloth", "answer_es", "Perezoso")
    ]


def test_question_is_identified_by_its_original_text():
    # Si el admin cambió el inglés, la clave es el texto original (el del dataset)
    current = {1: ("Which animal doesn't hibernate?", "The sloth")}
    history = [
        EditRecord(1, "question", "Which animal does not hibernate?", "Which animal doesn't hibernate?"),
        EditRecord(1, "answer", "Sloth", "The sloth"),
    ]
    edits = summarize_edits(history, current)
    assert {(e.question, e.answer) for e in edits} == {("Which animal does not hibernate?", "Sloth")}
    assert [(e.field, e.value) for e in edits] == [
        ("question", "Which animal doesn't hibernate?"),
        ("answer", "The sloth"),
    ]


def test_change_that_was_undone_is_not_saved():
    # Se ocultó y se volvió a mostrar: no quedó ningún cambio
    assert summarize(("is_active", "true", "false"), ("is_active", "false", "true")) == []


def test_undone_change_is_still_an_edited_key():
    # Aunque no haya cambio neto, el campo se tocó: la exportación lo saca del CSV
    history = [
        EditRecord(1, "answer_es", "Perezoso", "X"),
        EditRecord(1, "answer_es", "X", "Perezoso"),
    ]
    assert summarize_edits(history, CURRENT) == []
    assert edited_keys(history, CURRENT) == {
        ("Which animal does not hibernate?", "Sloth", "answer_es")
    }


def test_hidden_question_is_saved():
    assert [e.value for e in summarize(("is_active", "true", "false"))] == ["false"]


def test_fields_are_saved_in_a_fixed_order():
    edits = summarize(("is_active", "true", "false"), ("answer_es", "A", "B"), ("question", "Q", "Q2"))
    assert [e.field for e in edits] == ["question", "answer_es", "is_active"]


def test_unknown_fields_are_ignored():
    assert summarize(("translation_model", "x", "manual")) == []


def test_several_questions():
    current = {1: ("Q1", "A1"), 2: ("Q2", "A2")}
    history = [EditRecord(2, "answer_es", "x", "y"), EditRecord(1, "answer_es", "a", "b")]
    assert [e.question for e in summarize_edits(history, current)] == ["Q1", "Q2"]


# --- Juntar con lo que ya estaba en el CSV ---

def test_merge_new_wins_and_keeps_the_rest():
    old = [AdminEdit("Q1", "A1", "answer_es", "viejo"), AdminEdit("Q2", "A2", "is_active", "false")]
    new = [AdminEdit("Q1", "A1", "answer_es", "nuevo"), AdminEdit("Q3", "A3", "answer_es", "z")]
    assert merge_edits(old, new) == [
        AdminEdit("Q1", "A1", "answer_es", "nuevo"),
        AdminEdit("Q2", "A2", "is_active", "false"),
        AdminEdit("Q3", "A3", "answer_es", "z"),
    ]


# --- CSV ---

def test_save_and_load(tmp_path):
    path = tmp_path / "admin_edits.csv"
    edits = [
        AdminEdit("Capital, of France?", "París", "answer_es", 'Dice "París"'),
        AdminEdit("Q2", "A2", "is_active", "false"),
    ]
    save_admin_edits(edits, path)
    assert load_admin_edits(path) == edits  # comas y comillas sobreviven


def test_missing_file_means_no_edits(tmp_path):
    assert load_admin_edits(tmp_path / "no_existe.csv") == []


@pytest.mark.parametrize("row, message", [
    ("Q,A,answer_es,", "faltan"),               # sin valor
    (",A,answer_es,x", "faltan"),               # sin pregunta
    ("Q,A,source,x", "no se puede editar"),     # campo que no se edita
    ("Q,A,is_active,si", "true o false"),       # booleano inválido
])
def test_invalid_rows_are_rejected(tmp_path, row, message):
    path = tmp_path / "admin_edits.csv"
    path.write_text(f"question,answer,field,value\n{row}\n", encoding="utf-8")
    with pytest.raises(ValueError, match=message):
        load_admin_edits(path)


@pytest.mark.parametrize("field, value, expected", [
    ("is_active", "true", True),
    ("is_active", "false", False),
    ("answer_es", "true", "true"),  # en un campo de texto, "true" es texto
])
def test_parse_value(field, value, expected):
    assert parse_value(field, value) == expected


# --- Validar los cambios antes de aplicarlos ---

QUESTION = {
    "question": "Capital of France?", "answer": "Paris",
    "wrong_1": "Rome", "wrong_2": "Madrid", "wrong_3": "Berlin",
    "question_es": None, "answer_es": None,
    "wrong_1_es": None, "wrong_2_es": None, "wrong_3_es": None,
}
SPANISH = {
    "question_es": "¿Capital de Francia?", "answer_es": "París",
    "wrong_1_es": "Roma", "wrong_2_es": "Madrid", "wrong_3_es": "Berlín",
}


def test_valid_change():
    assert check_changes(QUESTION, False, {"answer": "París"}) == (None, False)


def test_repeated_english_options():
    error, _ = check_changes(QUESTION, False, {"answer": "rome"})
    assert "inglés" in error


def test_translate_by_hand_needs_the_5_fields():
    error, _ = check_changes(QUESTION, False, {"answer_es": "París"})
    assert "5 campos" in error
    assert check_changes(QUESTION, False, SPANISH) == (None, True)


def test_repeated_spanish_options():
    translated = {**QUESTION, **SPANISH}
    error, _ = check_changes(translated, True, {"answer_es": "Roma"})
    assert "español" in error


def test_one_spanish_field_of_a_translated_question():
    translated = {**QUESTION, **SPANISH}
    assert check_changes(translated, True, {"wrong_3_es": "Londres"}) == (None, False)