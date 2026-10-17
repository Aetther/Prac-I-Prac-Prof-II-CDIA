import os
import random
import secrets
from contextlib import asynccontextmanager
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Query, Security
from fastapi.security import APIKeyHeader
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.categories import CATEGORIES, find_category_by_name
from app.database import engine, get_db
from app.models import Base, Categorization, Question
from app.schemas import (
    CategorizationUpdate,
    GameAnswer,
    GameQuestion,
    GameResult,
    QuestionCreate,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Al arrancar: crear las tablas si no existen
    Base.metadata.create_all(bind=engine)
    yield
    # Al cerrar: no hace falta liberar nada


def env_flag(name: str, default: bool = True) -> bool:
    """
    Lee una variable de entorno de sí/no. Se considera desactivada con
    false, 0, no u off (sin distinguir mayúsculas); si no existe, usa default.
    """
    value = os.getenv(name)
    if value is None or not value.strip():
        return default
    return value.strip().lower() not in ("false", "0", "no", "off")


# Documentación interactiva (/docs, /redoc y /openapi.json). Activada por defecto;
# en un servidor público se puede apagar con ENABLE_DOCS=false en el .env.
DOCS_ENABLED = env_flag("ENABLE_DOCS", default=True)

app = FastAPI(
    title="Questions API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if DOCS_ENABLED else None,
    redoc_url="/redoc" if DOCS_ENABLED else None,
    openapi_url="/openapi.json" if DOCS_ENABLED else None,
)

# --- Autenticación para los endpoints de administración ---
# La clave se manda en el encabezado X-API-Key y se compara con API_KEY del .env
# (app.database ya cargó el .env al importarse).
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def require_api_key(api_key: str | None = Security(api_key_header)) -> None:
    """Deja pasar el pedido solo si trae la API key correcta."""
    expected = os.getenv("API_KEY")
    if not expected:
        # Sin clave configurada, la administración queda deshabilitada
        # (más seguro que dejarla abierta)
        raise HTTPException(
            status_code=503,
            detail="Administración deshabilitada: falta configurar API_KEY en el archivo .env",
        )
    # compare_digest tarda lo mismo acierte o no: no da pistas sobre la clave
    if api_key is None or not secrets.compare_digest(
        api_key.encode(), expected.encode()
    ):
        raise HTTPException(
            status_code=401,
            detail="API key inválida o faltante (encabezado X-API-Key)",
        )


# Respuestas posibles, para que /docs las muestre con su descripción
# (sin esto, los 401 y 503 aparecen como "Undocumented")
ADMIN_RESPONSES: dict[int | str, dict[str, Any]] = {
    401: {"description": "Falta la API key o es incorrecta (encabezado X-API-Key)"},
    503: {"description": "Administración deshabilitada: falta API_KEY en el .env"},
}


def not_found(description: str) -> dict[int | str, dict[str, Any]]:
    """Documenta un 404 con su descripción."""
    return {404: {"description": description}}


@app.get("/")
def root():
    return {
        "message": "Questions API funcionando",
        "endpoints": {
            "juego": [
                "/game/question?category={category_name}",
                "POST /game/answer",
            ],
            "publicos": ["/stats", "/categories", "/categories/stats"],
            "administracion (requieren X-API-Key)": [
                "/questions",
                "/questions/{id}",
                "/questions/category/{category_name}",
                "POST /questions",
                "PUT /categorizations/{id}",
            ],
        },
    }


# --- Juego (público): nunca revela la respuesta antes de que el jugador elija ---


@app.get(
    "/game/question",
    response_model=GameQuestion,
    responses=not_found("La categoría no existe o no hay preguntas categorizadas"),
)
def game_question(
    category: str | None = Query(
        None, max_length=100, description="Opcional: geografia, historia, ciencia, ..."
    ),
    db: Session = Depends(get_db),
):
    """
    Una pregunta al azar, con las 4 opciones mezcladas y sin indicar la correcta.
    Solo usa preguntas categorizadas (la categoría es la asignada).
    """
    query = db.query(Question, Categorization).join(
        Categorization, Categorization.question_id == Question.id
    )
    if category is not None:
        category = category.lower()
        if find_category_by_name(category) is None:
            raise HTTPException(
                status_code=404, detail=f"La categoría '{category}' no existe"
            )
        query = query.filter(Categorization.category_name == category)

    row = query.order_by(func.random()).first()
    if row is None:
        raise HTTPException(status_code=404, detail="No hay preguntas categorizadas")

    # Any: con los modelos estilo Column, Pylance no sabe que son valores comunes
    question: Any = row[0]
    categorization: Any = row[1]
    options = [question.answer, question.wrong_1, question.wrong_2, question.wrong_3]
    random.shuffle(options)
    return GameQuestion(
        id=question.id,
        question=question.question,
        category=categorization.category_name,
        options=options,
    )


@app.post(
    "/game/answer",
    response_model=GameResult,
    responses=not_found("La pregunta no existe"),
)
def game_answer(data: GameAnswer, db: Session = Depends(get_db)):
    """Comprueba la opción elegida y recién ahí revela la respuesta correcta."""
    question: Any = db.get(Question, data.question_id)
    if question is None:
        raise HTTPException(status_code=404, detail="Pregunta no encontrada")

    return GameResult(
        correct=data.answer.lower() == question.answer.lower(),
        correct_answer=question.answer,
    )


# --- Administración: muestran las respuestas, así que requieren la API key ---


@app.get(
    "/questions", dependencies=[Depends(require_api_key)], responses=ADMIN_RESPONSES
)
def list_questions(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    questions = db.query(Question).offset(skip).limit(limit).all()
    return questions


@app.get(
    "/questions/category/{category_name}",
    dependencies=[Depends(require_api_key)],
    responses={**ADMIN_RESPONSES, **not_found("La categoría no existe")},
)
def list_by_category(
    category_name: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """
    Preguntas categorizadas (por la IA o por una persona) con una categoría.
    Cada pregunta incluye su categoría original del dataset y la asignada.
    """
    category_name = category_name.lower()
    if find_category_by_name(category_name) is None:
        raise HTTPException(
            status_code=404, detail=f"La categoría '{category_name}' no existe"
        )

    rows = (
        db.query(Question, Categorization)
        .join(Categorization, Categorization.question_id == Question.id)
        .filter(Categorization.category_name == category_name)
        .order_by(Question.id)
        .offset(skip)
        .limit(limit)
        .all()
    )

    return [
        {
            "id": question.id,
            "categorization_id": categorization.id,
            "question": question.question,
            "answer": question.answer,
            "wrong_1": question.wrong_1,
            "wrong_2": question.wrong_2,
            "wrong_3": question.wrong_3,
            "original_category": question.category,
            "category_name": categorization.category_name,
            "confidence_score": categorization.confidence_score,
            "is_automatic": categorization.is_automatic,
        }
        for question, categorization in rows
    ]


@app.get(
    "/questions/{question_id}",
    dependencies=[Depends(require_api_key)],
    responses={**ADMIN_RESPONSES, **not_found("La pregunta no existe")},
)
def get_question(question_id: int, db: Session = Depends(get_db)):
    question = db.query(Question).filter(Question.id == question_id).first()
    if question is None:
        raise HTTPException(status_code=404, detail="Pregunta no encontrada")
    return question


@app.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    rows = (
        db.query(Question.category, func.count(Question.id))
        .group_by(Question.category)
        .order_by(Question.category)
        .all()
    )
    by_category = {(category or "Sin categoría"): count for category, count in rows}
    return {"total": sum(by_category.values()), "by_category": by_category}


@app.get("/categories")
def list_categories():
    """Lista de categorías disponibles para clasificar."""
    return CATEGORIES


@app.get("/categories/stats")
def category_stats(db: Session = Depends(get_db)):
    """Estadísticas de la categorización hecha con IA y revisión humana."""
    total_questions = db.query(func.count(Question.id)).scalar() or 0
    categorized = (
        db.query(func.count(func.distinct(Categorization.question_id))).scalar() or 0
    )
    automatic = (
        db.query(func.count(Categorization.id))
        .filter(Categorization.is_automatic.is_(True))
        .scalar()
        or 0
    )
    manual = (
        db.query(func.count(Categorization.id))
        .filter(Categorization.is_automatic.is_(False))
        .scalar()
        or 0
    )
    rows = (
        db.query(Categorization.category_name, func.count(Categorization.id))
        .group_by(Categorization.category_name)
        .order_by(Categorization.category_name)
        .all()
    )

    return {
        "total_questions": total_questions,
        "categorized": categorized,
        "uncategorized": total_questions - categorized,
        "automatic": automatic,
        "manual": manual,
        "by_category": {name: count for name, count in rows},
    }


@app.put(
    "/categorizations/{categorization_id}",
    dependencies=[Depends(require_api_key)],
    responses={**ADMIN_RESPONSES, **not_found("La categorización no existe")},
)
def update_categorization(
    categorization_id: int, data: CategorizationUpdate, db: Session = Depends(get_db)
):
    """
    Corrige la categoría asignada a una pregunta.
    La corrección la hace una persona, así que queda como no automática.
    La categoría ya llega validada y normalizada por CategorizationUpdate.
    """
    categorization = (
        db.query(Categorization).filter(Categorization.id == categorization_id).first()
    )
    if categorization is None:
        raise HTTPException(status_code=404, detail="Categorización no encontrada")

    db.query(Categorization).filter(Categorization.id == categorization_id).update(
        {"category_name": data.category_name, "is_automatic": False}
    )
    db.commit()
    db.refresh(categorization)

    return {
        "id": categorization.id,
        "question_id": categorization.question_id,
        "category_name": categorization.category_name,
        "confidence_score": categorization.confidence_score,
        "is_automatic": categorization.is_automatic,
        "created_at": categorization.created_at,
    }


@app.post(
    "/questions",
    status_code=201,
    dependencies=[Depends(require_api_key)],
    responses=ADMIN_RESPONSES,
)
def create_question(data: QuestionCreate, db: Session = Depends(get_db)):
    """
    Crea una pregunta nueva. Los datos ya llegan validados por QuestionCreate
    (largos, tipos, categoría existente y 4 opciones distintas).
    """
    question = Question(**data.model_dump(), source="manual")
    db.add(question)
    db.commit()
    db.refresh(question)
    return question