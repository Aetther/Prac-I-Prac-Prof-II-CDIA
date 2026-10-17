from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Engine,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    false,
    inspect,
    text,
)
from sqlalchemy.orm import relationship

from app.database import Base


class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    wrong_1 = Column(Text, nullable=False)
    wrong_2 = Column(Text, nullable=False)
    wrong_3 = Column(Text, nullable=False)
    category = Column(String(100), nullable=True)
    source = Column(String(255), nullable=True)

    # --- Traducción al español (ver app/translate_questions.py) ---
    # Se conserva el inglés original; vacías hasta que se traduce la pregunta
    question_es = Column(Text, nullable=True)
    answer_es = Column(Text, nullable=True)
    wrong_1_es = Column(Text, nullable=True)
    wrong_2_es = Column(Text, nullable=True)
    wrong_3_es = Column(Text, nullable=True)
    is_translated = Column(Boolean, nullable=False, default=False, server_default=false())
    translation_model = Column(String(255), nullable=True)


# Columnas de traducción y su definición en SQL, para agregarlas a una tabla
# que ya existía antes de este cambio (ver ensure_translation_columns)
TRANSLATION_COLUMNS: dict[str, str] = {
    "question_es": "TEXT",
    "answer_es": "TEXT",
    "wrong_1_es": "TEXT",
    "wrong_2_es": "TEXT",
    "wrong_3_es": "TEXT",
    "is_translated": "BOOLEAN NOT NULL DEFAULT false",
    "translation_model": "VARCHAR(255)",
}


def ensure_translation_columns(engine: Engine) -> list[str]:
    """
    Agrega a la tabla questions las columnas de traducción que falten.

    create_all() solo crea tablas nuevas: no modifica una tabla que ya existe.
    Una base creada antes de agregar la traducción no tendría estas columnas,
    y cualquier consulta a Question fallaría. Si ya existen, no hace nada.
    Devuelve los nombres de las columnas que agregó.
    """
    inspector = inspect(engine)
    if not inspector.has_table("questions"):
        return []  # la tabla todavía no existe: create_all la crea completa

    existing = {column["name"] for column in inspector.get_columns("questions")}
    missing = [name for name in TRANSLATION_COLUMNS if name not in existing]
    if missing:
        with engine.begin() as connection:  # begin: confirma al terminar
            for name in missing:
                connection.execute(
                    text(f"ALTER TABLE questions ADD COLUMN {name} {TRANSLATION_COLUMNS[name]}")
                )
    return missing


def utc_now() -> datetime:
    """Fecha y hora actual en UTC."""
    return datetime.now(timezone.utc)


class Categorization(Base):
    """
    Registra la categorización de cada pregunta.
    Guarda tanto las decisiones automáticas de la IA como las manuales del humano.
    """
    __tablename__ = "categorizations"

    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False, index=True)
    category_name = Column(String(100), nullable=False)
    confidence_score = Column(Float, nullable=False)
    is_automatic = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)

    question = relationship("Question", backref="categorizations")