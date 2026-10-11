"""
Actividad 2 (parte B): fine-tuning con SetFit usando las decisiones humanas.

1. Lee los ejemplos verificados por personas (data/training_data.csv)
2. Clasifica esos mismos ejemplos con el zero-shot, como referencia
3. Evalúa SetFit con validación cruzada de 5 partes: cada ejemplo se
   predice con un modelo que no lo vio al entrenar
4. Compara SetFit vs zero-shot, en especial en los casos manuales (difíciles)
5. Entrena el modelo final con todos los ejemplos y lo guarda

Uso:
    poetry run python -m app.train_setfit
"""
import csv
from pathlib import Path

import numpy as np
import torch
from datasets import Dataset
from setfit import SetFitModel, Trainer, TrainingArguments
from sklearn.model_selection import StratifiedKFold

from app.categories import get_category_descriptions, get_category_names
from app.classifier import AIClassifier, build_input_text
from app.export_training import OUTPUT_FILE as TRAINING_FILE
from app.review_automatic import label

BASE_MODEL = "sentence-transformers/all-mpnet-base-v2"
MODEL_DIR = Path("models") / "setfit-trivia"
N_FOLDS = 5
SEED = 42
LINE = "═" * 64


def load_examples() -> list[dict[str, str]]:
    with TRAINING_FILE.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def train_setfit(texts: list[str], label_ids: list[int]) -> SetFitModel:
    """Fine-tuning de un modelo SetFit con los textos y categorías dados."""
    model = SetFitModel.from_pretrained(BASE_MODEL)
    args = TrainingArguments(
        output_dir=str(Path("models") / "setfit-checkpoints"),
        save_strategy="no",  # no guardar copias intermedias del modelo
        batch_size=16,
        num_epochs=1,
        num_iterations=20,  # cantidad de pares generados por ejemplo
        seed=SEED,
    )
    trainer = Trainer(
        model=model,
        args=args,
        train_dataset=Dataset.from_dict({"text": texts, "label": label_ids}),
    )
    trainer.train()
    return model


def accuracy(predicted: np.ndarray, true: np.ndarray, mask: np.ndarray) -> str:
    if not mask.any():
        return "-"
    return f"{(predicted[mask] == true[mask]).mean():.1%}"


def main() -> None:
    examples = load_examples()
    names = get_category_names()
    name_to_id = {name: i for i, name in enumerate(names)}

    texts = [build_input_text(e["question"], e["answer"]) for e in examples]
    y = np.array([name_to_id[e["category_name"]] for e in examples])
    sources = np.array([e["source"] for e in examples])
    print(f"Ejemplos: {len(examples)}")

    # 1. Referencia: zero-shot sobre los mismos ejemplos
    descriptions = get_category_descriptions()
    desc_to_id = {d: i for i, d in enumerate(descriptions)}
    zero_shot = AIClassifier()
    zs_pred = np.array(
        [desc_to_id[r.category_name] for r in zero_shot.classify_batch(texts, descriptions)]
    )
    del zero_shot
    torch.cuda.empty_cache()  # liberamos la memoria de la GPU para SetFit

    # 2. SetFit con validación cruzada
    setfit_pred = np.zeros_like(y)
    folds = StratifiedKFold(n_splits=N_FOLDS, shuffle=True, random_state=SEED)
    for fold, (train_idx, test_idx) in enumerate(folds.split(texts, y), start=1):
        print(f"\n--- Parte {fold}/{N_FOLDS} ---")
        model = train_setfit([texts[i] for i in train_idx], y[train_idx].tolist())
        setfit_pred[test_idx] = model.predict([texts[i] for i in test_idx], as_numpy=True)

    # 3. Reporte
    everything = np.ones_like(y, dtype=bool)
    manual = sources == "manual"
    verified = sources == "automatica_verificada"

    print()
    print(LINE)
    print("ACIERTO: SetFit (validación cruzada) vs zero-shot")
    print(LINE)
    print(f"{'Grupo':<34} | {'N':>4} | {'Zero-shot':>9} | {'SetFit':>7}")
    print("-" * 64)
    for name, mask in [
        ("Todos", everything),
        ("Manuales (casos difíciles)", manual),
        ("Automáticos verificados", verified),
    ]:
        print(
            f"{name:<34} | {mask.sum():>4} | "
            f"{accuracy(zs_pred, y, mask):>9} | {accuracy(setfit_pred, y, mask):>7}"
        )

    print()
    print("Por categoría, solo casos manuales:")
    print(f"{'Categoría':<16} | {'N':>4} | {'Zero-shot':>9} | {'SetFit':>7}")
    print("-" * 64)
    for i, name in enumerate(names):
        mask = manual & (y == i)
        print(
            f"{label(name):<16} | {mask.sum():>4} | "
            f"{accuracy(zs_pred, y, mask):>9} | {accuracy(setfit_pred, y, mask):>7}"
        )
    print(LINE)

    # 4. Modelo final, entrenado con todos los ejemplos
    print("\nEntrenando el modelo final con todos los ejemplos...")
    final_model = train_setfit(texts, y.tolist())
    final_model.save_pretrained(str(MODEL_DIR))
    print(f"Modelo guardado en {MODEL_DIR}")


if __name__ == "__main__":
    main()