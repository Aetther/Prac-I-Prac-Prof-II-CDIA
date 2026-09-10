CATEGORIES = [
{
"name": "geografia",
"label": "Geography",
"description": (
"Questions about countries, cities, capitals, continents, "
"places, borders, maps, geographical features, cultures, "
"and the physical or political characteristics of the world."
),
},
{
"name": "ciencia",
"label": "Science",
"description": (
"Questions about natural and exact sciences, including physics, "
"chemistry, biology, astronomy, medicine, mathematics, animals, "
"plants, and scientific phenomena."
),
},
{
"name": "historia",
"label": "History",
"description": (
"Questions about historical events, civilizations, historical "
"figures, wars, revolutions, dates, empires, and important "
"events from the past."
),
},
{
"name": "deportes",
"label": "Sports",
"description": (
"Questions about sports, rules, competitions, teams, players, "
"athletes, championships, records, and sporting events."
),
},
{
"name": "arte",
"label": "Art",
"description": (
"Questions about painting, sculpture, literature, music, cinema, "
"and other forms of artistic expression, including artists, "
"works of art, and artistic movements."
),
},
{
"name": "entretenimiento",
"label": "Entertainment",
"description": (
"Questions about movies, series, television, popular music, "
"video games, celebrities, pop culture, and other topics "
"related to entertainment."
),
},
]


def get_category_names() -> list[str]:
    """Retorna los nombres internos de todas las categorías."""
    return [category["name"] for category in CATEGORIES]


def get_category_labels() -> list[str]:
    """Retorna los nombres legibles de todas las categorías."""
    return [category["label"] for category in CATEGORIES]


def get_category_descriptions() -> list[str]:
    """Retorna las descripciones de todas las categorías."""
    return [category["description"] for category in CATEGORIES]


def find_category_by_name(name: str) -> dict | None:
    """Busca y retorna una categoría por su nombre interno."""
    return next(
        (category for category in CATEGORIES if category["name"] == name),
        None,
    )