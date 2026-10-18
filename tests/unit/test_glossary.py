"""Glosario de correcciones de la traducción (sin base de datos ni modelo)."""
from types import SimpleNamespace

import pytest

from app.glossary import (
    CORRECTIONS_FILE,
    Correction,
    fix_punctuation,
    load_corrections,
    target_field,
)


# --- Regla de puntuación ---

@pytest.mark.parametrize("text, expected", [
    # El original era una pregunta terminada en punto
    ("¿Qué puerto es la capital de Guinea.", "¿Qué puerto es la capital de Guinea?"),
    ("¿A qué ciudad vamos..", "¿A qué ciudad vamos?"),  # punto de más en el original
    ("¿Cuál es el resto del verso: congelado cuando...", "¿Cuál es el resto del verso: congelado cuando...?"),
    ("¿Qué médico fue jefe en el programa de St.", "¿Qué médico fue jefe en el programa de St.?"),  # abreviatura
    ("¿Dónde queda la capital de los EE.UU.", "¿Dónde queda la capital de los EE.UU.?"),  # abreviatura
    ("¿Qué grupo tuvo un éxito en 1995 con Roll to Me.", "¿Qué grupo tuvo un éxito en 1995 con Roll to Me?"),  # "Me" no es abreviatura
    ("¿Cuál de los siguientes no es una red ESPN.", "¿Cuál de los siguientes no es una red ESPN?"),  # sigla, no abreviatura
    ("¿Qué película: Echa un vistazo. Podría ser la última.", "¿Qué película: Echa un vistazo. Podría ser la última?"),
    ("¿Y entonces dijo..?", "¿Y entonces dijo...?"),  # ..? nunca es correcto
    # Con un ? ya están bien: no se tocan (casos reales de la base)
    ("¿Cuál era el nombre del estado de Montana en los EE.UU.?", "¿Cuál era el nombre del estado de Montana en los EE.UU.?"),
    ("¿Qué acontecimiento ocurrió en el 44 a.C.?", "¿Qué acontecimiento ocurrió en el 44 a.C.?"),
    ("¿Cuándo nació Dale Earnhardt Jr.?", "¿Cuándo nació Dale Earnhardt Jr.?"),
    ("¿Quién dijo: siempre podemos cambiarlo.?", "¿Quién dijo: siempre podemos cambiarlo.?"),
    ("¿Cómo termina el dicho: El orgullo viene antes de ...?", "¿Cómo termina el dicho: El orgullo viene antes de ...?"),
    ("¿Cuál es el resto del verso: congelado cuando...?", "¿Cuál es el resto del verso: congelado cuando...?"),
    ("¿Por qué tan serio? es un lema de esta película.", "¿Por qué tan serio? es un lema de esta película."),
    ("¿Cuál es la capital de Francia?", "¿Cuál es la capital de Francia?"),
    ("Uno de estos tipos de tarifas no existe.", "Uno de estos tipos de tarifas no existe."),  # sin ¿
])
def test_fix_punctuation(text, expected):
    assert fix_punctuation(text) == expected


@pytest.mark.parametrize("text", [
    "¿Qué puerto es la capital de Guinea.",
    "¿Cuál es el resto del verso: congelado cuando...",
    "¿Y entonces dijo..?",
    "¿Qué médico fue jefe en el programa de St.",
])
def test_fix_punctuation_twice_gives_the_same(text):
    """Aplicar la regla dos veces da lo mismo que una (apply_glossary se puede repetir)."""
    once = fix_punctuation(text)
    assert fix_punctuation(once) == once


# --- A qué columna apunta cada corrección ---

QUESTION = SimpleNamespace(answer="Motley Crue", wrong_1="Bon Jovi", wrong_2="Winger", wrong_3="Poison")


@pytest.mark.parametrize("target, expected", [
    ("question", "question_es"),
    ("Motley Crue", "answer_es"),
    ("Poison", "wrong_3_es"),  # no hace falta saber en qué columna está
    ("poison", "wrong_3_es"),  # sin distinguir mayúsculas
    ("Sloth", None),  # ninguna opción coincide
])
def test_target_field(target, expected):
    assert target_field(QUESTION, target) == expected


# --- Lectura del CSV ---

def test_load_corrections(tmp_path):
    path = tmp_path / "corrections.csv"
    path.write_text(
        "question_id,target,es,note\n"
        "1,Sloth,Perezoso,el animal\n"
        '7,question,"¿Cuál, de estas?",\n',
        encoding="utf-8",
    )
    assert load_corrections(path) == [
        Correction(1, "Sloth", "Perezoso", "el animal"),
        Correction(7, "question", "¿Cuál, de estas?", ""),
    ]


def test_missing_file_means_no_corrections(tmp_path):
    assert load_corrections(tmp_path / "no_existe.csv") == []


@pytest.mark.parametrize("row", [
    "x,Sloth,Perezoso,",  # id no numérico
    "1,,Perezoso,",  # sin target
    "1,Sloth,,",  # sin traducción
])
def test_incomplete_rows_are_rejected(tmp_path, row):
    path = tmp_path / "corrections.csv"
    path.write_text(f"question_id,target,es,note\n{row}\n", encoding="utf-8")
    with pytest.raises(ValueError, match="línea 2"):
        load_corrections(path)


def test_project_corrections_file_is_valid():
    """El CSV del proyecto se puede leer y no tiene correcciones duplicadas."""
    corrections = load_corrections(CORRECTIONS_FILE)
    assert corrections, "data/translation_corrections.csv está vacío o no existe"
    keys = [(c.question_id, c.target.casefold()) for c in corrections]
    assert len(keys) == len(set(keys))