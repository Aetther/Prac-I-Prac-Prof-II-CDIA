"""
Clasificador alternativo: Sentence Transformers + similitud coseno.

En lugar de zero-shot classification, convierte en embeddings las preguntas
y las descripciones de las categorías, y asigna a cada pregunta la categoría
cuya descripción es más parecida (mayor similitud coseno).

Tiene la misma interfaz que AIClassifier, así se pueden intercambiar.
"""
import numpy as np
import torch
from sentence_transformers import SentenceTransformer

from app.classifier import ClassificationResult

EMBEDDING_MODEL = "sentence-transformers/all-mpnet-base-v2"

# Factor para convertir similitudes en probabilidades (ver _to_probabilities)
SIMILARITY_SCALE = 20.0


class CosineClassifier:
    """Clasificador basado en similitud coseno entre embeddings."""

    def __init__(self, model_name: str = EMBEDDING_MODEL, scale: float = SIMILARITY_SCALE):
        self.model_name = model_name
        self.scale = scale
        device = "cuda" if torch.cuda.is_available() else "cpu"

        print(f"Cargando modelo {model_name} en {device}...")
        self.encoder = SentenceTransformer(model_name, device=device)
        print("Modelo cargado.")

        # Embeddings de las categorías: se calculan una sola vez
        self._label_cache: dict[tuple[str, ...], np.ndarray] = {}

    def _encode(self, texts: list[str], batch_size: int) -> np.ndarray:
        """Convierte textos en vectores de largo 1 (normalizados)."""
        return self.encoder.encode(
            texts,
            batch_size=batch_size,
            convert_to_numpy=True,
            normalize_embeddings=True,
        )

    def _to_probabilities(self, similarities: np.ndarray) -> np.ndarray:
        """
        Convierte similitudes coseno (entre -1 y 1) en probabilidades que suman 1,
        con softmax. Las similitudes suelen estar muy juntas (ej. 0.31 vs 0.28),
        así que se multiplican por `scale` para que las diferencias se noten.
        """
        logits = similarities * self.scale
        logits -= logits.max(axis=1, keepdims=True)  # estabilidad numérica
        exp = np.exp(logits)
        return exp / exp.sum(axis=1, keepdims=True)

    def classify_batch(
        self, texts: list[str], candidate_labels: list[str], batch_size: int = 64
    ) -> list[ClassificationResult]:
        """Clasifica varios textos contra las mismas categorías candidatas."""
        if not texts:
            return []

        key = tuple(candidate_labels)
        if key not in self._label_cache:
            self._label_cache[key] = self._encode(list(candidate_labels), batch_size)
        label_embeddings = self._label_cache[key]

        # Con vectores normalizados, el producto escalar ES la similitud coseno
        similarities = self._encode(texts, batch_size) @ label_embeddings.T
        probabilities = self._to_probabilities(similarities)

        results = []
        for probs in probabilities:
            best = int(probs.argmax())
            results.append(
                ClassificationResult(
                    category_name=candidate_labels[best],
                    confidence_score=float(probs[best]),
                    all_scores={
                        label: float(p) for label, p in zip(candidate_labels, probs)
                    },
                )
            )
        return results

    def classify(self, text: str, candidate_labels: list[str]) -> ClassificationResult:
        """Clasifica un texto individual."""
        return self.classify_batch([text], candidate_labels)[0]