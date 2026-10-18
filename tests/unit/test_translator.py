"""
Funciones auxiliares de la traducción (no cargan el modelo).

translator.py importa transformers y torch: si no están instalados
(grupo de dependencias de IA), estos tests se saltean en lugar de fallar.
"""
import pytest

pytest.importorskip("transformers")

from app.translate_questions import options_are_distinct  # noqa: E402
from app.translator import extract_option, post_process  # noqa: E402


# --- post_process: signos de apertura ---

@pytest.mark.parametrize("text, expected", [
    ("Quién pintó la Mona Lisa?", "¿Quién pintó la Mona Lisa?"),  # falta el ¿
    ("¿Quién pintó la Mona Lisa?", "¿Quién pintó la Mona Lisa?"),  # ya lo tiene
    # El modelo ya puso el ¿ en la última oración: no se agrega otro al principio
    ("En el Japón antiguo era difícil. ¿Cómo?", "En el Japón antiguo era difícil. ¿Cómo?"),
    ("Qué gran jugada!", "¡Qué gran jugada!"),
    ("  Una afirmación.  ", "Una afirmación."),  # recorta espacios
    ("Una afirmación.", "Una afirmación."),  # sin signos: no cambia
])
def test_post_process(text, expected):
    assert post_process(text) == expected


# --- extract_option: la opción dentro de "<pregunta> Respuesta: <opción>" ---

@pytest.mark.parametrize("translated, original, expected", [
    ("¿Cuál no hiberna? Respuesta: Ratón.", "Mouse", "Ratón"),  # quita el punto agregado
    # Una opción con ':' no se corta
    ("¿Qué película? Respuesta: Star Wars: Episodio IV.", "Star Wars: Episode IV",
     "Star Wars: Episodio IV"),
    ("¿Quién? respuesta : Dr.", "Dr.", "Dr."),  # el original tenía punto: se conserva
    ("Respuesta: A. Respuesta: B", "B", "B"),  # usa la última aparición
    ("Texto sin la etiqueta", "X", None),  # el modelo no tradujo "Answer:"
    ("¿Cuál? Respuesta:   ", "X", None),  # etiqueta sin opción
])
def test_extract_option(translated, original, expected):
    assert extract_option(translated, original) == expected


# --- options_are_distinct: con opciones repetidas no se puede jugar ---

@pytest.mark.parametrize("options, expected", [
    (["Ratón", "Rana", "Serpiente", "Perezoso"], True),
    (["cachorros", "terneros", "Cachorros", "picos"], False),  # repetida (mayúsculas)
    (["Ohio", " ohio ", "Virginia", "Maryland"], False),  # repetida (espacios)
    (["Ohio", "", "Virginia", "Maryland"], False),  # vacía
])
def test_options_are_distinct(options, expected):
    assert options_are_distinct(options) is expected