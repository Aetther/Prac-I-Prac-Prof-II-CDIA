"""
Traducción automática inglés -> español con un modelo MarianMT de Helsinki-NLP.

En transformers 5 ya no existe pipeline("translation") (el que usa la consigna),
así que se usa el modelo directamente, que es lo que el pipeline hacía por dentro:
  1. el tokenizador convierte el texto en tokens (números),
  2. el modelo (Encoder-Decoder) genera la traducción con beam search,
  3. el tokenizador vuelve a convertir los tokens en texto.

Las opciones de respuesta se traducen junto con su pregunta, como
"<pregunta> Answer: <opción>", y después se extrae lo que quedó después de
"Respuesta:". Con el contexto de la pregunta, el modelo distingue mejor qué
traducir ("Mouse" -> "Ratón") y qué no (el título de un álbum). Ver la
comparación de alternativas en el README.

Memoria de la GPU: los textos se traducen ordenados por largo (así cada lote
tiene textos parecidos y casi no hay relleno), y si un lote no entra en la
memoria, se divide en dos y se reintenta, en lugar de cortar todo el proceso.
"""
import re
from typing import Any

import torch
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

from app.glossary import fix_punctuation
from app.model_versions import get_revision

TRANSLATION_MODEL = "Helsinki-NLP/opus-mt-en-es"

OPTION_TEMPLATE = "{question} Answer: {option}"
# Cómo traduce el modelo "Answer:" (sin distinguir mayúsculas ni espacios)
ANSWER_LABEL = re.compile(r"respuesta\s*:", re.IGNORECASE)


def post_process(text: str) -> str:
    """
    Limpia la traducción de una pregunta: quita espacios sobrantes y agrega el
    signo de apertura (¿ o ¡) solo si el modelo no puso ninguno. Si ya hay uno
    en el texto (por ejemplo, en la última oración), se respeta. Al final aplica
    la regla de puntuación del glosario (app/glossary.py).
    """
    text = text.strip()
    if text.endswith("?") and "¿" not in text:
        text = "¿" + text
    if text.endswith("!") and "¡" not in text:
        text = "¡" + text
    return fix_punctuation(text)


def extract_option(translated: str, original: str) -> str | None:
    """
    Extrae la opción traducida de "<pregunta> Respuesta: <opción>".
    Usa la última aparición de "Respuesta:", así una opción que tenga ':'
    (por ejemplo, "Star Wars: Episode IV") no se corta. Devuelve None si el
    modelo no tradujo la etiqueta como se esperaba.
    """
    matches = list(ANSWER_LABEL.finditer(translated))
    if not matches:
        return None
    value = translated[matches[-1].end():].strip()
    # El modelo suele agregar un punto final que la opción original no tenía
    if value.endswith(".") and not original.endswith("."):
        value = value[:-1].rstrip()
    return value or None


class Translator:
    """Traductor inglés -> español. Usa la GPU si está disponible."""

    def __init__(self, model_name: str = TRANSLATION_MODEL):
        self.model_name = model_name
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        revision = get_revision(model_name)  # versión fija (app/model_versions.py)

        print(f"Cargando modelo de traducción {model_name} en {self.device}...")
        self.tokenizer: Any = AutoTokenizer.from_pretrained(model_name, revision=revision)
        self.model: Any = AutoModelForSeq2SeqLM.from_pretrained(
            model_name, revision=revision
        ).to(self.device)
        self.model.eval()  # modo evaluación: no se entrena, solo se usa
        # Cuántas veces hubo que dividir un lote por falta de memoria en la GPU
        self.memory_splits = 0
        print("Modelo cargado.")

    @torch.inference_mode()  # no guarda datos para entrenar: más rápido y menos memoria
    def _run_model(self, chunk: list[str]) -> list[str]:
        """Traduce un lote de textos con el modelo."""
        inputs = self.tokenizer(
            chunk, return_tensors="pt", padding=True, truncation=True
        ).to(self.device)
        # generate usa la configuración del modelo (beam search con 4 caminos)
        outputs = self.model.generate(**inputs)
        return self.tokenizer.batch_decode(outputs, skip_special_tokens=True)

    def _translate_chunk(self, chunk: list[str]) -> list[str]:
        """
        Traduce un lote. Si no entra en la memoria de la GPU, lo divide en dos
        mitades y traduce cada una por separado (y así sucesivamente).
        """
        try:
            return self._run_model(chunk)
        except torch.OutOfMemoryError:
            if len(chunk) == 1:
                raise  # ni un solo texto entra: no hay nada más que dividir
            if torch.cuda.is_available():
                torch.cuda.empty_cache()  # libera la memoria que quedó reservada
            self.memory_splits += 1
            half = len(chunk) // 2
            return self._translate_chunk(chunk[:half]) + self._translate_chunk(chunk[half:])

    def _generate(self, texts: list[str], batch_size: int) -> list[str]:
        """
        Traducción "en bruto", sin post-procesamiento, en lotes.

        Los textos se procesan ordenados por largo: el modelo rellena todos los
        textos de un lote hasta el largo del más largo, así que mezclar textos
        cortos con largos desperdicia memoria y tiempo. Al final se devuelven
        en el orden original.
        """
        order = sorted(range(len(texts)), key=lambda i: len(texts[i]))
        results = [""] * len(texts)
        for start in range(0, len(order), batch_size):
            indexes = order[start:start + batch_size]
            translated = self._translate_chunk([texts[i] for i in indexes])
            for i, text in zip(indexes, translated):
                results[i] = text
        return results

    def translate_batch(self, texts: list[str], batch_size: int = 32) -> list[str]:
        """
        Traduce una lista de textos (por ejemplo, preguntas) en lotes.
        Procesar varios a la vez es mucho más rápido en GPU que de a uno.
        """
        return [post_process(t) for t in self._generate(texts, batch_size)]

    def translate(self, text: str) -> str:
        """Traduce un solo texto."""
        return self.translate_batch([text])[0]

    def translate_options_batch(
        self, questions: list[str], options: list[list[str]], batch_size: int = 32
    ) -> list[list[str]]:
        """
        Traduce las opciones de varias preguntas. options[i] son las opciones
        de questions[i]. Cada opción se traduce con su pregunta como contexto;
        si no se puede extraer, se usa la traducción directa como respaldo.
        """
        pairs = [(q, o) for q, opts in zip(questions, options) for o in opts]
        prompts = [OPTION_TEMPLATE.format(question=q, option=o) for q, o in pairs]
        extracted = [
            extract_option(t, o)
            for t, (_, o) in zip(self._generate(prompts, batch_size), pairs)
        ]

        # Respaldo: traducción directa de las que no se pudieron extraer
        missing = [i for i, value in enumerate(extracted) if value is None]
        if missing:
            direct = self._generate([pairs[i][1] for i in missing], batch_size)
            for i, text in zip(missing, direct):
                extracted[i] = text.strip()

        # Volver a agrupar por pregunta
        flat = [value or o for value, (_, o) in zip(extracted, pairs)]
        grouped: list[list[str]] = []
        position = 0
        for opts in options:
            grouped.append(flat[position:position + len(opts)])
            position += len(opts)
        return grouped

    def translate_options(self, question: str, options: list[str]) -> list[str]:
        """Traduce las opciones de una sola pregunta."""
        return self.translate_options_batch([question], [options])[0]