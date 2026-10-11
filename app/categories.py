"""
Definición centralizada de las categorías disponibles para clasificación.

Cada categoría tiene:
- name: identificador interno (snake_case)
- label: nombre legible para mostrar al usuario. Coincide con la columna
         `category` de la tabla questions, para poder comparar la
         clasificación de la IA con la categoría original del dataset.
- description: texto que la IA usa para entender la categoría. Está en
               inglés porque el modelo (bart-large-mnli) y las preguntas
               están en inglés.
"""

CATEGORIES: list[dict[str, str]] = [
    {
        "name": "geografia",
        "label": "Geografía",
        "description": "geography: countries, capitals, cities, rivers, mountains, oceans, continents, flags and maps",
    },
    {
        "name": "historia",
        "label": "Historia",
        "description": "history: past events, wars, empires, kings, presidents, revolutions and ancient civilizations",
    },
    {
        "name": "ciencia",
        "label": "Ciencia",
        "description": "science and nature: biology, animals, chemistry, physics, medicine, astronomy and technology",
    },
    {
        "name": "arte",
        "label": "Arte",
        "description": "literature and fine arts: novels, books, writers, poets, poetry, plays, playwrights, Shakespeare, literary characters, painters, sculptors, museums, architecture, classical music, opera, mythology and philosophy",
    },
    {
        "name": "entretenimiento",
        "label": "Entretenimiento",
        "description": "pop culture and entertainment: films, movie actors, TV series, sitcoms, soap operas, pop and rock music, singers, bands, celebrities and video games",
    },
    {
        "name": "deportes",
        "label": "Deportes",
        "description": "sports: football, soccer, basketball, tennis, olympics, athletes, teams and championships",
    },
]


def get_category_names() -> list[str]:
    """Retorna una lista con los nombres (name) de todas las categorías."""
    return [c["name"] for c in CATEGORIES]


def get_category_labels() -> list[str]:
    """Retorna una lista con los labels legibles de todas las categorías."""
    return [c["label"] for c in CATEGORIES]


def get_category_descriptions() -> list[str]:
    """Retorna una lista con las descripciones de todas las categorías."""
    return [c["description"] for c in CATEGORIES]


def find_category_by_name(name: str) -> dict | None:
    """Busca y retorna una categoría por su nombre. Retorna None si no existe."""
    for category in CATEGORIES:
        if category["name"] == name:
            return category
    return None