from app.categories import get_category_descriptions, get_category_names
from app.classifier import AIClassifier

# Le pasamos al modelo las descripciones (más informativas que los nombres)
# y después traducimos la descripción ganadora a su nombre corto.
descriptions = get_category_descriptions()
desc_to_name = dict(zip(descriptions, get_category_names()))

classifier = AIClassifier()

questions = [
    "Which river flows through Cairo?",
    "Who painted the ceiling of the Sistine Chapel?",
    "How many players are on a soccer team on the field?",
    "In which year did World War II end?",
    "Which band released the album Abbey Road?",
    "What is the chemical symbol for gold?",
]

for result, text in zip(classifier.classify_batch(questions, descriptions), questions):
    name = desc_to_name[result.category_name]
    print(f"{name:<16} {result.confidence_score:.0%}  {text}")