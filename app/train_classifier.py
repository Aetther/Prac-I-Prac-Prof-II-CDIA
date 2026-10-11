"""
Mejora: clasificador entrenado con las preguntas ya categorizadas.

1. Toma las preguntas categorizadas (por la IA con alta confianza o por una persona)
2. Las convierte en embeddings con sentence-transformers
3. Entrena una regresión logística con scikit-learn
4. Lo evalúa y lo prueba sobre las preguntas pendientes
5. Guarda el modelo entrenado en models/embedding_classifier.joblib

No escribe nada en la base de datos.

Uso:
    poetry run python -m app.train_classifier
"""
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import torch
from sentence_transformers import SentenceTransformer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split
from sqlalchemy import select

from app.categories import CATEGORIES
from app.classifier import build_input_text
from app.database import SessionLocal
from app.models import Categorization, Question

EMBEDDING_MODEL = "sentence-transformers/all-mpnet-base-v2"
MODEL_PATH = Path("models") / "embedding_classifier.joblib"
THRESHOLDS = [0.5, 0.6, 0.7, 0.8, 0.9]


def load_data() -> tuple[list[Any], list[Any]]:
    """Devuelve (preguntas categorizadas, preguntas pendientes)."""
    db = SessionLocal()
    try:
        labeled = (
            db.query(
                Question.question,
                Question.answer,
                Question.category,
                Categorization.category_name,
            )
            .join(Categorization, Categorization.question_id == Question.id)
            .order_by(Question.id)
            .all()
        )
        categorized_ids = select(Categorization.question_id)
        pending = (
            db.query(Question.question, Question.answer, Question.category)
            .filter(~Question.id.in_(categorized_ids))
            .order_by(Question.id)
            .all()
        )
    finally:
        db.close()
    return labeled, pending


def embed(encoder: SentenceTransformer, rows: list[Any]) -> np.ndarray:
    """Convierte cada pregunta (con su respuesta) en un vector de números."""
    texts = [build_input_text(r.question, r.answer) for r in rows]
    return encoder.encode(
        texts,
        batch_size=128,
        show_progress_bar=True,
        convert_to_numpy=True,
        normalize_embeddings=True,
    )


def main() -> None:
    labeled, pending = load_data()
    print(f"Preguntas categorizadas (entrenamiento): {len(labeled)}")
    print(f"Preguntas pendientes:                   {len(pending)}")
    print()

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Cargando {EMBEDDING_MODEL} en {device}...")
    encoder = SentenceTransformer(EMBEDDING_MODEL, device=device)

    print("Generando embeddings de las preguntas categorizadas...")
    X = embed(encoder, labeled)
    y = np.array([r.category_name for r in labeled])

    # 1. Evaluación: entrenamos con el 80% y medimos sobre el 20% restante
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    clf = LogisticRegression(max_iter=1000, class_weight="balanced")
    clf.fit(X_train, y_train)

    print()
    print("═" * 64)
    print("1) ¿Qué tan bien imita las categorías ya asignadas? (20% reservado)")
    print("═" * 64)
    print(classification_report(y_test, clf.predict(X_test), digits=3))

    # 2. Modelo final: entrenado con todas las preguntas categorizadas
    clf.fit(X, y)

    # 3. Prueba sobre las pendientes, comparando con la categoría del dataset
    print("Generando embeddings de las preguntas pendientes...")
    X_pending = embed(encoder, pending)
    proba = clf.predict_proba(X_pending)
    predicted = clf.classes_[proba.argmax(axis=1)]
    confidence = proba.max(axis=1)

    label_to_name = {c["label"]: c["name"] for c in CATEGORIES}
    original = np.array([label_to_name.get(r.category) for r in pending])
    agree = predicted == original
    no_geo = original != "geografia"

    print()
    print("═" * 64)
    print(f"2) Preguntas pendientes ({len(pending)}): coincidencia con el dataset")
    print("═" * 64)
    print(f"Coincidencia top-1:               {agree.mean():.1%}")
    print(f"Coincidencia top-1 sin Geografía: {agree[no_geo].mean():.1%}")
    print()
    print(f"{'Umbral':>7} | {'Cobertura':>10} | {'Coincidencia':>13} | {'Coinc. sin Geografía':>21}")
    print("-" * 64)
    for threshold in THRESHOLDS:
        covered = confidence >= threshold
        if not covered.any():
            print(f"{threshold:>7.0%} | {0:>10.1%} | {'-':>13} | {'-':>21}")
            continue
        covered_no_geo = covered & no_geo
        agree_no_geo = agree[covered_no_geo].mean() if covered_no_geo.any() else 0.0
        print(
            f"{threshold:>7.0%} | {covered.mean():>10.1%} | "
            f"{agree[covered].mean():>13.1%} | {agree_no_geo:>21.1%}"
        )
    print("═" * 64)

    MODEL_PATH.parent.mkdir(exist_ok=True)
    joblib.dump(clf, MODEL_PATH)
    print(f"\nModelo guardado en {MODEL_PATH}")


if __name__ == "__main__":
    main()