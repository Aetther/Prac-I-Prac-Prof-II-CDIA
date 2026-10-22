"""
Correcciones hechas por un admin desde la API, guardadas en el repositorio.

Lo que el admin cambia (PATCH y DELETE de /questions) queda en la base, en el
historial question_edits. Para que no se pierda si se vuelve a cargar el
dataset, se exporta a data/admin_edits.csv (app/export_admin_edits.py) y se
vuelve a aplicar con app/restore_admin_edits.py.

Cada fila es el valor FINAL de un campo de una pregunta. La pregunta se
identifica por su texto original en inglés y su respuesta original (no por el
id, que puede cambiar si el dataset se carga de otra forma), igual que en
data/training_data.csv.

Este módulo no usa la base: solo la lógica. Los scripts la aplican.
"""
import csv
from collections import defaultdict
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.glossary import options_are_distinct
from app.schemas import EN_FIELDS, ES_FIELDS

EDITS_FILE = Path("data") / "admin_edits.csv"
CSV_FIELDS = ["question", "answer", "field", "value"]

# Campos que un admin puede cambiar, en el orden en que se guardan
EDITABLE_FIELDS: tuple[str, ...] = (*EN_FIELDS, *ES_FIELDS, "is_active")
FIELD_ORDER = {field: i for i, field in enumerate(EDITABLE_FIELDS)}


@dataclass(frozen=True)
class EditRecord:
    """Una fila del historial question_edits (en orden cronológico)."""

    question_id: int
    field: str
    old_value: str | None
    new_value: str | None


@dataclass(frozen=True)
class AdminEdit:
    """Valor final de un campo de una pregunta (una fila de admin_edits.csv)."""

    question: str  # texto original en inglés
    answer: str  # respuesta original en inglés
    field: str
    value: str

    @property
    def key(self) -> tuple[str, str, str]:
        return (self.question, self.answer, self.field)


def _final_values(
    history: list[EditRecord], current: dict[int, tuple[str, str]]
) -> Iterator[tuple[AdminEdit, str | None]]:
    """
    Para cada campo editado de cada pregunta: el valor final (como AdminEdit,
    con la pregunta identificada por su texto original) y el valor que tenía
    antes de la primera edición.

    Si el admin cambió el texto en inglés, el original es el valor anterior de
    la primera edición de ese campo.
    """
    by_question: dict[int, list[EditRecord]] = defaultdict(list)
    for record in history:
        if record.field in FIELD_ORDER:
            by_question[record.question_id].append(record)

    for question_id in sorted(by_question):
        first_old: dict[str, str | None] = {}
        last_new: dict[str, str | None] = {}
        for record in by_question[question_id]:
            first_old.setdefault(record.field, record.old_value)  # solo la primera vez
            last_new[record.field] = record.new_value  # se pisa: queda la última

        now_question, now_answer = current[question_id]
        original_question = first_old.get("question") or now_question
        original_answer = first_old.get("answer") or now_answer

        for field in sorted(last_new, key=FIELD_ORDER.__getitem__):
            edit = AdminEdit(original_question, original_answer, field, last_new[field] or "")
            yield edit, first_old[field]


def summarize_edits(
    history: list[EditRecord], current: dict[int, tuple[str, str]]
) -> list[AdminEdit]:
    """
    Resume el historial: el valor final de cada campo editado de cada pregunta.

    history: las ediciones en orden cronológico.
    current: {question_id: (pregunta, respuesta)} como están ahora en la base.

    Si un campo terminó igual que al principio (por ejemplo, se ocultó y se
    volvió a mostrar), no hay nada que guardar.
    """
    return [
        edit
        for edit, original in _final_values(history, current)
        if edit.value and edit.value != original
    ]


def edited_keys(
    history: list[EditRecord], current: dict[int, tuple[str, str]]
) -> set[tuple[str, str, str]]:
    """
    Todos los campos que el admin tocó, aunque hayan terminado igual que al
    principio. Sirve para sacar del CSV las correcciones que el admin deshizo.
    """
    return {edit.key for edit, _ in _final_values(history, current)}


def merge_edits(existing: list[AdminEdit], new: list[AdminEdit]) -> list[AdminEdit]:
    """
    Junta las correcciones del CSV con las nuevas. Si las dos tienen el mismo
    campo de la misma pregunta, gana la nueva. El orden es estable: primero las
    que ya estaban, después las nuevas.
    """
    merged: dict[tuple[str, str, str], AdminEdit] = {e.key: e for e in existing}
    for edit in new:
        merged[edit.key] = edit
    return list(merged.values())


def load_admin_edits(path: Path = EDITS_FILE) -> list[AdminEdit]:
    """Lee las correcciones del CSV. Falla si una fila está incompleta o el campo no existe."""
    if not path.exists():
        return []
    edits = []
    with path.open(newline="", encoding="utf-8") as f:
        for line, row in enumerate(csv.DictReader(f), start=2):
            values = {name: (row.get(name) or "").strip() for name in CSV_FIELDS}
            if not all(values.values()):
                raise ValueError(f"{path}, línea {line}: faltan question, answer, field o value")
            if values["field"] not in FIELD_ORDER:
                raise ValueError(f"{path}, línea {line}: el campo '{values['field']}' no se puede editar")
            if values["field"] == "is_active" and values["value"] not in ("true", "false"):
                raise ValueError(f"{path}, línea {line}: is_active tiene que ser true o false")
            edits.append(AdminEdit(**values))
    return edits


def save_admin_edits(edits: list[AdminEdit], path: Path = EDITS_FILE) -> None:
    """Escribe las correcciones en el CSV (lo reemplaza completo)."""
    path.parent.mkdir(exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        writer.writeheader()
        for edit in edits:
            writer.writerow(
                {"question": edit.question, "answer": edit.answer,
                 "field": edit.field, "value": edit.value}
            )


def check_changes(
    current: dict[str, Any], is_translated: bool, changes: dict[str, Any]
) -> tuple[str | None, bool]:
    """
    Controla que los cambios dejen una pregunta jugable (las mismas reglas que
    PATCH /questions/{id}). Devuelve (error, traduce_a_mano):

    - error: None si los cambios son válidos, o el motivo por el que no.
    - traduce_a_mano: True si la pregunta no estaba traducida y los cambios
      traen los 5 campos en español (queda traducida a mano).
    """
    new = {f: changes.get(f, current.get(f)) for f in (*EN_FIELDS, *ES_FIELDS)}
    es_sent = [f for f in ES_FIELDS if f in changes]
    translating = bool(es_sent) and not is_translated
    if translating and len(es_sent) != len(ES_FIELDS):
        return (
            "la pregunta no está traducida: para traducirla a mano hacen falta "
            "los 5 campos en español",
            False,
        )
    if not options_are_distinct([new[f] for f in EN_FIELDS[1:]]):
        return "las 4 opciones en inglés quedarían repetidas", False
    if (is_translated or translating) and not options_are_distinct(
        [new[f] for f in ES_FIELDS[1:]]
    ):
        return "las 4 opciones en español quedarían repetidas", False
    return None, translating


def parse_value(field: str, value: str) -> str | bool:
    """Convierte el texto del CSV al tipo de la columna (is_active es booleano)."""
    if field == "is_active":
        return value == "true"
    return value