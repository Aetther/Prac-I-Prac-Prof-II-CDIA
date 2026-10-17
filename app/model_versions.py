"""
Versiones fijas (commits) de los modelos de Hugging Face que usa el proyecto.

Sin versión fija, cada descarga trae la última que haya publicado el autor,
y los resultados podrían cambiar sin tocar el código. Con un commit fijo,
todos usan exactamente el mismo modelo con el que se midieron los resultados.

Para actualizar un modelo a propósito: cambiar su commit acá y volver a
medir con app/evaluate.py.
"""

MODEL_REVISIONS: dict[str, str] = {
    # Clasificador principal (zero-shot)
    "MoritzLaurer/deberta-v3-large-zeroshot-v2.0": "cf44676c28ba7312e5c5f8f8d2c22b3e0c9cdae2",
    # Embeddings: similitud coseno, pseudo-etiquetado y base de SetFit
    "sentence-transformers/all-mpnet-base-v2": "e8c3b32edf5434bc2275fc9bab85f82640a19130",
    # Modelos de la comparación (app/evaluate.py --model ...)
    "facebook/bart-large-mnli": "d7645e127eaf1aefc7862fd59a17a5aa8558b8ce",
    "MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli": "6f5cf0a2b59cabb106aca4c287eed12e357e90eb",
    # Traducción inglés -> español (app/translator.py)
    "Helsinki-NLP/opus-mt-en-es": "5bc4493d463cf000c1f0b50f8d56886a392ed4ab",
}


def get_revision(model_name: str) -> str | None:
    """
    Devuelve el commit fijo del modelo. Si el modelo no está en la lista
    (por ejemplo, uno nuevo que se prueba con evaluate --model), avisa y
    devuelve None: se usa la versión más reciente.
    """
    revision = MODEL_REVISIONS.get(model_name)
    if revision is None:
        print(
            f"Aviso: {model_name} no tiene versión fija en app/model_versions.py; "
            "se usa la más reciente."
        )
    return revision