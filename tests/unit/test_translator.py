"""
Funciones auxiliares de la traducción (no cargan el modelo).

translator.py importa transformers y torch: si no están instalados
(grupo de dependencias de IA), estos tests se saltean en lugar de fallar.
"""
import pytest

pytest.importorskip("transformers")

import torch  # noqa: E402

from app.translate_questions import options_are_distinct  # noqa: E402
from app.translator import Translator, extract_option, post_process  # noqa: E402


class FakeTranslator(Translator):
    """
    Traductor falso: no carga el modelo. "Traduce" pasando a mayúsculas y
    simula que la GPU se queda sin memoria con lotes de más de max_batch textos.
    """

    def __init__(self, max_batch: int):
        self.max_batch = max_batch
        self.memory_splits = 0
        self.batches: list[list[str]] = []

    def _run_model(self, chunk: list[str]) -> list[str]:
        if len(chunk) > self.max_batch:
            raise torch.OutOfMemoryError("sin memoria (simulado)")
        self.batches.append(chunk)
        return [text.upper() for text in chunk]


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


# --- Lotes: orden por largo y falta de memoria en la GPU ---

def test_results_keep_the_original_order():
    texts = ["una pregunta larga", "corta", "otra pregunta mediana", "b"]
    translator = FakeTranslator(max_batch=10)
    assert translator._generate(texts, batch_size=2) == [t.upper() for t in texts]


def test_batches_group_texts_of_similar_length():
    translator = FakeTranslator(max_batch=10)
    translator._generate(["aaaa", "b", "ccc", "dd"], batch_size=2)
    assert translator.batches == [["b", "dd"], ["ccc", "aaaa"]]


def test_batch_without_memory_is_split_and_retried():
    texts = [f"texto {i}" for i in range(8)]
    translator = FakeTranslator(max_batch=2)  # solo entran lotes de 2
    assert translator._generate(texts, batch_size=8) == [t.upper() for t in texts]
    # 8 -> 4 + 4 -> cada 4 -> 2 + 2: tres divisiones
    assert translator.memory_splits == 3


def test_single_text_without_memory_raises():
    translator = FakeTranslator(max_batch=0)  # no entra ni un texto
    with pytest.raises(torch.OutOfMemoryError):
        translator._generate(["texto"], batch_size=1)