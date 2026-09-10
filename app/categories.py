CATEGORIES = [
    {
        "name": "geografia",
        "label": "Geografía",
        "description": (
            "Preguntas sobre países, ciudades, capitales, continentes, "
            "lugares, fronteras, mapas, accidentes geográficos, culturas "
            "y características físicas o políticas del mundo."
        ),
    },
    {
        "name": "ciencia",
        "label": "Ciencia",
        "description": (
            "Preguntas sobre ciencias naturales y exactas, incluyendo física, "
            "química, biología, astronomía, medicina, matemáticas, animales, "
            "plantas y fenómenos científicos."
        ),
    },
    {
        "name": "historia",
        "label": "Historia",
        "description": (
            "Preguntas sobre acontecimientos históricos, civilizaciones, "
            "personajes históricos, guerras, revoluciones, fechas, imperios "
            "y acontecimientos importantes del pasado."
        ),
    },
    {
        "name": "deportes",
        "label": "Deportes",
        "description": (
            "Preguntas sobre deportes, reglas, competiciones, equipos, "
            "jugadores, atletas, campeonatos, récords y acontecimientos "
            "deportivos."
        ),
    },
    {
        "name": "arte",
        "label": "Arte",
        "description": (
            "Preguntas sobre pintura, escultura, literatura, música, cine "
            "y otras formas de expresión artística, incluyendo artistas, "
            "obras y movimientos artísticos."
        ),
    },
    {
        "name": "entretenimiento",
        "label": "Entretenimiento",
        "description": (
            "Preguntas sobre películas, series, televisión, música popular, "
            "videojuegos, celebridades, cultura pop y otros temas relacionados "
            "con el entretenimiento."
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