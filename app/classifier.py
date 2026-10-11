"""
Módulo de clasificación de texto usando IA.

Usa zero-shot classification con transformers (Hugging Face): el modelo
evalúa, para cada categoría candidata, qué tan probable es que la frase
"This trivia question is about <categoría>." se deduzca del texto.

El modelo por defecto (DeBERTa v3 large zero-shot v2.0) se eligió tras
comparar variantes con app/evaluate.py: clasifica mejor y con más confianza
que facebook/bart-large-mnli, el modelo sugerido originalmente.
"""
from dataclasses import dataclass
from typing import Any

import torch
from transformers import pipeline

# Modelo elegido tras comparar variantes con app/evaluate.py
DEFAULT_MODEL = "MoritzLaurer/deberta-v3-large-zeroshot-v2.0"

# Frase que el pipeline completa con cada categoría candidata.
# Está en inglés porque el modelo y las preguntas están en inglés.
HYPOTHESIS_TEMPLATE = "This trivia question is about {}."


def build_input_text(question: str, answer: str | None = None) -> str:
    """
    Arma el texto que ve el modelo. Incluir la respuesta correcta le da
    más contexto y mejoró levemente la clasificación en las pruebas.
    """
    return f"{question} Answer: {answer}" if answer else question


@dataclass
class ClassificationResult:
    """
    Resultado de una clasificación.

    Atributos:
        category_name: nombre de la categoría asignada
        confidence_score: score de confianza (0.0 a 1.0)
        all_scores: diccionario con los scores de todas las categorías
    """
    category_name: str
    confidence_score: float
    all_scores: dict[str, float]


class AIClassifier:
    """
    Clasificador de texto basado en IA.

    Usa la GPU automáticamente si está disponible; si no, usa la CPU.
    """

    def __init__(
        self,
        model_name: str = DEFAULT_MODEL,
        hypothesis_template: str = HYPOTHESIS_TEMPLATE,
    ):
        self.model_name = model_name
        self.hypothesis_template = hypothesis_template

        # 0 = primera GPU, -1 = CPU
        self.device = 0 if torch.cuda.is_available() else -1
        device_name = torch.cuda.get_device_name(0) if self.device == 0 else "CPU"

        print(f"Cargando modelo {model_name} en {device_name}...")
        print("(La primera vez se descarga el modelo, puede tardar unos minutos)")
        self.pipeline = pipeline(
            "zero-shot-classification", model=model_name, device=self.device
        )
        print("Modelo cargado.")

    @staticmethod
    def _to_result(output: Any) -> ClassificationResult:
        """Convierte la salida del pipeline en un ClassificationResult."""
        return ClassificationResult(
            category_name=output["labels"][0],
            confidence_score=float(output["scores"][0]),
            all_scores=dict(zip(output["labels"], map(float, output["scores"]))),
        )

    def classify(self, text: str, candidate_labels: list[str]) -> ClassificationResult:
        """Clasifica un texto individual contra una lista de categorías candidatas."""
        output: Any = self.pipeline(
            text,
            candidate_labels=candidate_labels,
            hypothesis_template=self.hypothesis_template,
        )
        return self._to_result(output)

    def classify_batch(
        self, texts: list[str], candidate_labels: list[str], batch_size: int = 16
    ) -> list[ClassificationResult]:
        """
        Clasifica múltiples textos contra las mismas categorías candidatas.

        Usa el batching nativo del pipeline: le pasa la lista completa y el
        modelo procesa varios textos a la vez, mucho más rápido en GPU que
        llamar a classify() uno por uno.
        """
        if not texts:
            return []
        outputs: Any = self.pipeline(
            texts,
            candidate_labels=candidate_labels,
            hypothesis_template=self.hypothesis_template,
            batch_size=batch_size,
        )
        return [self._to_result(o) for o in outputs]