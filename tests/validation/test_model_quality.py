"""
Validación del modelo de IA contra las decisiones humanas (data/training_data.csv).

Los umbrales mínimos están un poco por debajo de lo medido (85,9% de top-1
general, 68,3% en los casos difíciles y 100% en las de alta confianza), para
tolerar variaciones menores sin dejar pasar una caída real de calidad.

Es lento (carga el modelo), por eso no corre por defecto:
    poetry run pytest -m slow -v
"""
import csv

import pytest

pytest.importorskip("transformers")

from app.categories import get_category_descriptions, get_category_names  # noqa: E402
from app.classifier import AIClassifier, build_input_text  # noqa: E402
from app.export_training import OUTPUT_FILE as TRAINING_FILE  # noqa: E402

pytestmark = pytest.mark.slow

CONFIDENCE_THRESHOLD = 0.70
MIN_TOP1_ALL = 0.80
MIN_TOP1_HARD = 0.60
MIN_PRECISION_CONFIDENT = 0.95


@pytest.fixture(scope="module")
def results():
    """Clasifica una sola vez todos los ejemplos humanos y reutiliza el resultado."""
    if not TRAINING_FILE.exists():
        pytest.skip(f"No existe {TRAINING_FILE}")
    with TRAINING_FILE.open(newline="", encoding="utf-8") as f:
        examples = list(csv.DictReader(f))

    descriptions = get_category_descriptions()
    desc_to_name = dict(zip(descriptions, get_category_names()))
    classifier = AIClassifier()
    predictions = classifier.classify_batch(
        [build_input_text(e["question"], e["answer"]) for e in examples], descriptions
    )
    return [
        {
            "true": e["category_name"],
            "predicted": desc_to_name[p.category_name],
            "confidence": p.confidence_score,
            "source": e["source"],
        }
        for e, p in zip(examples, predictions)
    ]


def accuracy(rows) -> float:
    return sum(r["predicted"] == r["true"] for r in rows) / len(rows)


def test_top1_accuracy_on_all_human_decisions(results):
    assert accuracy(results) >= MIN_TOP1_ALL


def test_top1_accuracy_on_hard_cases(results):
    hard = [r for r in results if r["source"] == "manual"]
    assert accuracy(hard) >= MIN_TOP1_HARD


def test_confident_predictions_are_precise(results):
    # Las decisiones que el sistema tomaría automáticamente deben ser casi siempre correctas
    confident = [r for r in results if r["confidence"] >= CONFIDENCE_THRESHOLD]
    assert confident, "Ninguna predicción supera el umbral"
    assert accuracy(confident) >= MIN_PRECISION_CONFIDENT