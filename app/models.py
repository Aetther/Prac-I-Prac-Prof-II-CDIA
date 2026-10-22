from datetime import datetime, timezone

from sqlalchemy import (
    DDL,
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
)
from sqlalchemy.orm import relationship
from sqlalchemy.schema import CreateColumn

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


# Columnas de traducción, para agregarlas a una tabla que ya existía antes de
# este cambio (ver ensure_translation_columns). Su tipo sale del modelo Question.
TRANSLATION_COLUMNS: tuple[str, ...] = (
    "question_es",
    "answer_es",
    "wrong_1_es",
    "wrong_2_es",
    "wrong_3_es",
    "is_translated",
    "translation_model",
)


def ensure_translation_columns(engine: Engine) -> list[str]:
    """
    Agrega a la tabla questions las columnas de traducción que falten.

    create_all() solo crea tablas nuevas: no modifica una tabla que ya existe.
    Una base creada antes de agregar la traducción no tendría estas columnas,
    y cualquier consulta a Question fallaría. Si ya existen, no hace nada.
    Devuelve los nombres de las columnas que agregó.

    El SQL no se escribe a mano: SQLAlchemy genera la definición de cada
    columna a partir del modelo (CreateColumn) y pone las comillas a los
    nombres, así que ningún texto se pega directamente en la sentencia.
    """
    inspector = inspect(engine)
    if not inspector.has_table("questions"):
        return []  # la tabla todavía no existe: create_all la crea completa

    table = Question.__table__
    unknown = [name for name in TRANSLATION_COLUMNS if name not in table.c]
    if unknown:
        raise ValueError(f"No son columnas del modelo Question: {unknown}")

    existing = {column["name"] for column in inspector.get_columns("questions")}
    missing = [name for name in TRANSLATION_COLUMNS if name not in existing]
    if missing:
        table_name = engine.dialect.identifier_preparer.format_table(table)
        with engine.begin() as connection:  # begin: confirma al terminar
            for name in missing:
                column = CreateColumn(table.c[name]).compile(dialect=engine.dialect)
                connection.execute(DDL(f"ALTER TABLE {table_name} ADD COLUMN {column}"))
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