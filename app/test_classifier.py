from app.classifier import AIClassifier
from app.categories import CATEGORIES


classifier = AIClassifier()

labels = [
    f"{category['label']}: {category['description']}"
    for category in CATEGORIES
]

result = classifier.classify(
    "what country is the grand bahama island in?",
    labels
)

print("\nCategoria:", result.category_name)
print("Confianza:", f"{result.confidence_score:.2%}")

print("\nScores:")
for category, score in result.all_scores.items():
    print(f"  {category}: {score:.2%}")