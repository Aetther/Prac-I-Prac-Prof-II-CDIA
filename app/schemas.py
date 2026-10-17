"""
Esquemas de Pydantic: describen cómo tienen que ser los datos que recibe la API.

FastAPI los usa para validar el cuerpo de cada pedido antes de llegar al
endpoint. Si algo no cumple (falta un campo, es muy largo, no es texto, etc.),
responde 422 automáticamente indicando qué campo falló y por qué.
"""
from typing import Annotated

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)

from app.categories import CATEGORIES

# Límites de largo. Se eligieron midiendo las preguntas reales:
# la pregunta más larga tiene 628 caracteres y la opción más larga, 255.
MAX_QUESTION_LENGTH = 1000
MAX_OPTION_LENGTH = 300
MAX_CATEGORY_LENGTH = 100

# Texto que se recorta (espacios al principio y al final) y no puede quedar vacío
QuestionText = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_QUESTION_LENGTH),
]
OptionText = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_OPTION_LENGTH),
]
CategoryText = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_CATEGORY_LENGTH),
]


def find_category(value: str) -> dict[str, str]:
    """
    Busca una categoría por su nombre ('geografia') o su etiqueta ('Geografía'),
    sin distinguir mayúsculas. Si no existe, lanza ValueError (Pydantic lo
    convierte en un error 422).
    """
    key = value.lower()
    for category in CATEGORIES:
        if key in (category["name"], category["label"].lower()):
            return category
    valid = ", ".join(c["name"] for c in CATEGORIES)
    raise ValueError(f"La categoría '{value}' no existe. Opciones: {valid}")


class QuestionCreate(BaseModel):
    """Datos para crear una pregunta (POST /questions)."""

    # extra="forbid": rechaza campos que no existen (por ejemplo, "source").
    # strict=True: no convierte tipos (un número donde va texto se rechaza).
    model_config = ConfigDict(
        extra="forbid",
        strict=True,
        json_schema_extra={
            "examples": [
                {
                    "question": "¿Cuál es la capital de Chaco?",
                    "answer": "Resistencia",
                    "wrong_1": "Corrientes",
                    "wrong_2": "Formosa",
                    "wrong_3": "Posadas",
                    "category": "Geografía",
                }
            ]
        },
    )

    question: QuestionText
    answer: OptionText
    wrong_1: OptionText
    wrong_2: OptionText
    wrong_3: OptionText
    category: CategoryText = Field(
        description="Una de las 6 categorías, como nombre ('geografia') o etiqueta ('Geografía')"
    )

    @field_validator("category")
    @classmethod
    def category_must_exist(cls, value: str) -> str:
        # Se guarda siempre la etiqueta ("Geografía"), igual que las preguntas del dataset
        return find_category(value)["label"]

    @model_validator(mode="after")
    def options_must_be_different(self) -> "QuestionCreate":
        options = [self.answer, self.wrong_1, self.wrong_2, self.wrong_3]
        if len({o.lower() for o in options}) != 4:
            raise ValueError("Las 4 opciones deben ser distintas")
        return self


class CategorizationUpdate(BaseModel):
    """Datos para corregir una categorización (PUT /categorizations/{id})."""

    model_config = ConfigDict(
        extra="forbid",
        strict=True,
        json_schema_extra={"examples": [{"category_name": "arte"}]},
    )

    category_name: CategoryText = Field(
        description="Una de las 6 categorías, como nombre ('arte') o etiqueta ('Arte')"
    )

    @field_validator("category_name")
    @classmethod
    def category_must_exist(cls, value: str) -> str:
        # Las categorizaciones guardan el nombre ("arte"), no la etiqueta
        return find_category(value)["name"]