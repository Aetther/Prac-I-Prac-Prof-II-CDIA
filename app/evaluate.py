"""
Banco de pruebas del clasificador.

Clasifica una muestra fija de preguntas (siempre las mismas, gracias a una
semilla) y mide cobertura y coincidencia con el dataset para varios umbrales.
No escribe nada en la base de datos.

Permite comparar dos técnicas:
- zero-shot: clasificación zero-shot con transformers (por defecto)
- cosine: embeddings de Sentence Transformers + similitud coseno

Uso:
    poetry run python -m app.evaluate
    poetry run python -m app.evaluate --with-answer
    poetry run python -m app.evaluate --model facebook/bart-large-mnli
    poetry run python -m app.evaluate --method cosine --with-answer
"""
import argparse
import random
from collections import Counter
from typing import Any

from tqdm import tqdm

from app.categories import CATEGORIES, get_category_descriptions, get_category_names
from app.classifier import DEFAULT_MODEL, HYPOTHESIS_TEMPLATE, AIClassifier, build_input_text
from app.cosine_classifier import CosineClassifier
from app.database import SessionLocal
from app.models import Question

THRESHOLDS = [0.5, 0.6, 0.7, 0.8, 0.9]
CHUNK_SIZE = 256


def load_sample(size: int, seed: int) -> list[Any]:
    """Devuelve siempre la misma muestra aleatoria de preguntas para una semilla dada."""
    db = SessionLocal()
    try:
        rows = (
            db.query(Question.question, Question.answer, Question.category)
            .order_by(Question.id)
            .all()
        )
    finally:
        db.close()
    rng = random.Random(seed)
    return rng.sample(rows, min(size, len(rows)))


def build_text(row: Any, with_answer: bool) -> str:
    """Arma el texto que ve el modelo: solo la pregunta, o pregunta + respuesta."""
    return build_input_text(row.question, row.answer if with_answer else None)


def evaluate(args: argparse.Namespace) -> None:
    sample = load_sample(args.sample, args.seed)
    texts = [build_text(row, args.with_answer) for row in sample]

    descriptions = get_category_descriptions()
    desc_to_name = dict(zip(descriptions, get_category_names()))
    label_to_name = {c["label"]: c["name"] for c in CATEGORIES}

    # Los dos clasificadores tienen la misma interfaz: el resto del código
    # funciona igual con cualquiera de ellos.
    if args.method == "cosine":
        classifier = CosineClassifier()
    else:
        classifier = AIClassifier(model_name=args.model, hypothesis_template=args.template)

    # (categoría predicha, score, categoría del dataset)
    predictions: list[tuple[str, float, str | None]] = []
    for start in tqdm(range(0, len(texts), CHUNK_SIZE), desc="Evaluando", unit="tanda"):
        results = classifier.classify_batch(
            texts[start : start + CHUNK_SIZE], descriptions, args.batch_size
        )
        for row, result in zip(sample[start : start + CHUNK_SIZE], results):
            predictions.append(
                (
                    desc_to_name[result.category_name],
                    result.confidence_score,
                    label_to_name.get(row.category),
                )
            )

    total = len(predictions)
    print()
    print("═" * 64)
    if args.method == "cosine":
        print(f"Método:    similitud coseno ({classifier.model_name})")
    else:
        print(f"Método:    zero-shot ({args.model})")
        print(f"Plantilla: {args.template}")
    print(f"Texto:     {'pregunta + respuesta' if args.with_answer else 'solo pregunta'}")
    print(f"Muestra:   {total} preguntas (semilla {args.seed})")
    print("═" * 64)

    top1 = sum(pred == orig for pred, _, orig in predictions)
    print(f"Coincidencia sin umbral (top-1): {top1 / total:.1%}")
    print()
    print(f"{'Umbral':>7} | {'Cobertura':>10} | {'Coincidencia':>13} | {'Coinc. sin Geografía':>21}")
    print("-" * 64)

    for threshold in THRESHOLDS:
        covered = [p for p in predictions if p[1] >= threshold]
        if not covered:
            print(f"{threshold:>7.0%} | {0:>10.1%} | {'-':>13} | {'-':>21}")
            continue

        agree = sum(pred == orig for pred, _, orig in covered) / len(covered)
        no_geo = [p for p in covered if p[2] != "geografia"]
        agree_no_geo = (
            sum(pred == orig for pred, _, orig in no_geo) / len(no_geo) if no_geo else 0.0
        )
        print(
            f"{threshold:>7.0%} | {len(covered) / total:>10.1%} | "
            f"{agree:>13.1%} | {agree_no_geo:>21.1%}"
        )
    print("═" * 64)

    # Detalle por categoría del dataset: cuánto acierta y con qué se confunde
    print()
    print("Por categoría del dataset (top-1, sin umbral):")
    print(f"{'Dataset':<16} | {'Total':>5} | {'Acierto':>7} | Confusiones más frecuentes")
    print("-" * 64)
    for name in get_category_names():
        rows = [p for p in predictions if p[2] == name]
        if not rows:
            continue
        hits = sum(pred == name for pred, _, _ in rows)
        wrong = Counter(pred for pred, _, _ in rows if pred != name).most_common(2)
        confusions = ", ".join(f"{n} ({c})" for n, c in wrong) or "-"
        print(f"{name:<16} | {len(rows):>5} | {hits / len(rows):>7.1%} | {confusions}")
    print("═" * 64)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evalúa variantes del clasificador")
    parser.add_argument("--method", choices=["zero-shot", "cosine"], default="zero-shot",
                        help="Técnica de clasificación")
    parser.add_argument("--sample", type=int, default=2000, help="Tamaño de la muestra")
    parser.add_argument("--seed", type=int, default=42, help="Semilla de la muestra")
    parser.add_argument("--model", default=DEFAULT_MODEL,
                        help="Modelo de Hugging Face (solo para zero-shot)")
    parser.add_argument("--template", default=HYPOTHESIS_TEMPLATE,
                        help="Frase de hipótesis (solo para zero-shot)")
    parser.add_argument("--with-answer", action="store_true",
                        help="Incluir la respuesta correcta en el texto")
    parser.add_argument("--batch-size", type=int, default=16)
    return parser.parse_args()


if __name__ == "__main__":
    evaluate(parse_args())