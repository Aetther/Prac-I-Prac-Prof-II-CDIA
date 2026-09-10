from dataclasses import dataclass


@dataclass
class ClassificationResult:

    category_name: str
    confidence_score: float
    all_scores: dict[str, float]


class AIClassifier:

    def __init__(self, model_name: str = "facebook/bart-large-mnli"):
        from transformers import pipeline

        print(f"Cargando modelo de IA: {model_name}...")

        self.pipeline = pipeline(
            "zero-shot-classification",
            model=model_name
        )

        self.model_name = model_name

    def classify(
        self,
        text: str,
        candidate_labels: list[str]
    ) -> ClassificationResult:

        result = self.pipeline(
            text,
            candidate_labels=candidate_labels
        )

        return ClassificationResult(
            category_name=result["labels"][0],
            confidence_score=result["scores"][0],
            all_scores=dict(zip(result["labels"], result["scores"]))
        )

    def classify_batch(
        self,
        texts: list[str],
        candidate_labels: list[str]
    ) -> list[ClassificationResult]:

        results = []

        for text in texts:
            result = self.classify(text, candidate_labels)
            results.append(result)

        return results