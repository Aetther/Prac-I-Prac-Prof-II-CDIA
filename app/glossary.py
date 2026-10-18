"""
Glosario de correcciones de la traducción (paso 9 de la consigna: post-procesamiento).

Tiene dos partes:

1. Reglas generales: correcciones que se pueden hacer con código sin romper
   otros casos. Hoy es una sola, la de puntuación. translator.post_process la
   usa, así que las traducciones nuevas ya salen corregidas.

2. Correcciones por pregunta: data/translation_corrections.csv, escritas por
   una persona. Hacen falta porque muchos errores dependen del contexto: "Sloth"
   es "Perezoso" (el animal), "Pereza" (el pecado de Seven) o "Sloth" (el
   personaje de Los Goonies), según la pregunta. Ninguna regla por palabra
   resuelve eso.

Este módulo no usa la base ni el modelo: solo la lógica. app/apply_glossary.py
lo aplica a la base.
"""
import csv
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

CORRECTIONS_FILE = Path("data") / "translation_corrections.csv"
CORRECTION_FIELDS = ["question_id", "target", "es", "note"]

# Qué columna en español corresponde a cada columna en inglés
OPTION_FIELDS = {
    "answer": "answer_es",
    "wrong_1": "wrong_1_es",
    "wrong_2": "wrong_2_es",
    "wrong_3": "wrong_3_es",
}
QUESTION_TARGET = "question"

# Abreviaturas al final del texto, cuyo punto no cierra la oración:
# letras con punto dos o más veces ("EE.UU.", "a.C.", "P.I.", "M.D.") o una
# de las abreviaturas comunes en el dataset ("St.", "Jr.", "Dr.", "Bros.")
ABBREVIATION = re.compile(
    r"(?:\b[A-Za-z]{1,3}\.){2,}$|\b(?:St|Jr|Sr|Dr|Mr|Mrs|Ms|Hrs|Inc|Ltd|Co|Bros|vs|etc)\.$"
)


def options_are_distinct(options: list[str]) -> bool:
    """True si las opciones no están vacías y son todas distintas (sin mayúsculas)."""
    normalized = [o.strip().casefold() for o in options]
    return all(normalized) and len(set(normalized)) == len(normalized)


def fix_punctuation(text: str) -> str:
    """
    Corrige las preguntas que abren con ¿ pero terminan en punto. Pasa cuando
    el original es una pregunta que termina en punto ("What port ... of Guinea.").

    Solo actúa si el texto no tiene ningún ?: si hay uno, el ¿ puede abrir una
    pregunta citada ("¿Por qué tan serio? es un lema de esta película.") y el
    ".?" puede ser parte de una abreviatura ("los EE.UU.?").

    - Uno o dos puntos al final se cambian por ?    ("Guinea." -> "Guinea?")
    - Tres o más son puntos suspensivos ("completá la frase"): se conservan
      y se agrega el ?                                ("cuando..." -> "cuando...?")
    - Si el punto es de una abreviatura, se conserva  ("St." -> "St.?")
    - Única excepción con ?: "..?" nunca es correcto  ("dijo..?" -> "dijo...?")
    """
    if not text.startswith("¿"):
        return text
    if text.endswith("..?") and not text.endswith("...?"):
        return text[:-3] + "...?"
    if "?" in text:
        return text

    stripped = text.rstrip(".")
    dots = len(text) - len(stripped)
    if dots == 0:
        return text
    if dots >= 3:
        return stripped.rstrip() + "...?"
    if dots == 1 and ABBREVIATION.search(text):
        return text + "?"
    return stripped.rstrip() + "?"


@dataclass(frozen=True)
class Correction:
    question_id: int
    target: str  # "question" o el texto en inglés de la opción
    es: str  # la traducción correcta
    note: str = ""


def load_corrections(path: Path = CORRECTIONS_FILE) -> list[Correction]:
    """Lee las correcciones del CSV. Falla si a una fila le falta un dato."""
    if not path.exists():
        return []
    corrections = []
    with path.open(newline="", encoding="utf-8") as f:
        for line, row in enumerate(csv.DictReader(f), start=2):
            question_id = (row.get("question_id") or "").strip()
            target = (row.get("target") or "").strip()
            es = (row.get("es") or "").strip()
            if not question_id.isdigit() or not target or not es:
                raise ValueError(f"{path}, línea {line}: faltan question_id, target o es")
            corrections.append(
                Correction(int(question_id), target, es, (row.get("note") or "").strip())
            )
    return corrections


def target_field(question: Any, target: str) -> str | None:
    """
    Columna en español que corresponde a `target` en esta pregunta:
    "question_es" si target es "question", o la columna de la opción cuyo
    texto en inglés es igual a target (sin distinguir mayúsculas).
    Devuelve None si ninguna opción coincide.
    """
    if target == QUESTION_TARGET:
        return "question_es"
    for en_field, es_field in OPTION_FIELDS.items():
        if (getattr(question, en_field) or "").strip().casefold() == target.casefold():
            return es_field
    return None