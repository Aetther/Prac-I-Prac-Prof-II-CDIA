import os
import random
import secrets
from contextlib import asynccontextmanager
from typing import Any, Literal

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Security
from fastapi.security import APIKeyHeader
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.categories import CATEGORIES, find_category_by_name
from app.database import engine, get_db
from app.glossary import options_are_distinct
from app.models import (
    Base,
    Categorization,
    Question,
    QuestionEdit,
    Report,
    ensure_question_columns,
    utc_now,
)
from app.rate_limit import RateLimiter
from app.schemas import (
    EN_FIELDS,
    ES_FIELDS,
    CategorizationUpdate,
    GameAnswer,
    GameQuestion,
    GameResult,
    Lang,
    QuestionCreate,
    QuestionUpdate,
    ReportCreate,
    ReportUpdate,
)

# Valor de translation_model para las preguntas que tradujo a mano un admin
MANUAL_TRANSLATION = "manual"

# Reportes: cuántos puede mandar una misma IP por minuto
REPORTS_PER_MINUTE = 10
report_limiter = RateLimiter(max_requests=REPORTS_PER_MINUTE, window_seconds=60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Al arrancar: crear las tablas que no existan y agregar las columnas
    # nuevas a una base creada antes (traducción y administración)
    Base.metadata.create_all(bind=engine)
    ensure_question_columns(engine)
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


def question_to_dict(question: Any) -> dict[str, Any]:
    """Todos los campos de una pregunta (para las respuestas de administración)."""
    return {column.name: getattr(question, column.name) for column in Question.__table__.columns}


def client_ip(request: Request) -> str:
    """IP de quien hace el pedido (solo se usa para el límite de reportes)."""
    return request.client.host if request.client else "desconocida"


def report_to_dict(report: Any, question: Any) -> dict[str, Any]:
    """Un reporte con los datos de su pregunta, para que el admin la vea sin otra consulta."""
    return {
        "id": report.id,
        "question_id": report.question_id,
        "reason": report.reason,
        "comment": report.comment,
        "lang": report.lang,
        "status": report.status,
        "created_at": report.created_at,
        "resolved_at": report.resolved_at,
        "question": {
            "question": question.question,
            "answer": question.answer,
            "question_es": question.question_es,
            "answer_es": question.answer_es,
            "is_translated": question.is_translated,
            "is_active": question.is_active,
        },
    }


def edit_value(value: Any) -> str | None:
    """Valor como texto, para guardarlo en el historial de ediciones."""
    if value is None:
        return None
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


@app.get("/")
def root():
    return {
        "message": "Questions API funcionando",
        "endpoints": {
            "juego": [
                "/game/question?category={category_name}&lang=es",
                "POST /game/answer?lang=es",
            ],
            "publicos": [
                "POST /reports",
                "/stats",
                "/categories",
                "/categories/stats",
                "/translation/stats",
            ],
            "administracion (requieren X-API-Key)": [
                "/questions?status=all|active|hidden",
                "/questions/{id}",
                "/questions/{id}/edits",
                "/questions/category/{category_name}",
                "POST /questions",
                "PATCH /questions/{id}",
                "DELETE /questions/{id}",
                "PUT /categorizations/{id}",
                "/reports?status=pendiente|resuelto|descartado|todos",
                "/reports/stats",
                "PATCH /reports/{id}",
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
    lang: Lang = Query("es", description="Idioma: 'es' (español) o 'en' (inglés)"),
    db: Session = Depends(get_db),
):
    """
    Una pregunta al azar, con las 4 opciones mezcladas y sin indicar la correcta.
    Solo usa preguntas categorizadas (la categoría es la asignada) y visibles
    (las que un admin ocultó no salen).
    Si se pide español y la pregunta no tiene traducción, viene en inglés
    (el campo lang de la respuesta lo indica).
    """
    query = (
        db.query(Question, Categorization)
        .join(Categorization, Categorization.question_id == Question.id)
        .filter(Question.is_active.is_(True))
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

    served_lang: Lang  # Lang y no str: así Pylance acepta pasarlo a GameQuestion
    if lang == "es" and question.is_translated:
        text = question.question_es
        options = [
            question.answer_es,
            question.wrong_1_es,
            question.wrong_2_es,
            question.wrong_3_es,
        ]
        served_lang = "es"
    else:
        text = question.question
        options = [question.answer, question.wrong_1, question.wrong_2, question.wrong_3]
        served_lang = "en"

    random.shuffle(options)
    return GameQuestion(
        id=question.id,
        question=text,
        category=categorization.category_name,
        options=options,
        lang=served_lang,
    )


@app.post(
    "/game/answer",
    response_model=GameResult,
    responses=not_found("La pregunta no existe"),
)
def game_answer(
    data: GameAnswer,
    lang: Lang = Query(
        "es", description="Idioma en que se devuelve la respuesta correcta"
    ),
    db: Session = Depends(get_db),
):
    """
    Comprueba la opción elegida y recién ahí revela la respuesta correcta.
    Acepta la respuesta en cualquiera de los dos idiomas.
    """
    question: Any = db.get(Question, data.question_id)
    if question is None:
        raise HTTPException(status_code=404, detail="Pregunta no encontrada")

    correct_answers = {question.answer.lower()}
    if question.is_translated:
        correct_answers.add(question.answer_es.lower())

    use_es = lang == "es" and question.is_translated
    return GameResult(
        correct=data.answer.lower() in correct_answers,
        correct_answer=question.answer_es if use_es else question.answer,
    )


# --- Administración: muestran las respuestas, así que requieren la API key ---


@app.get(
    "/questions", dependencies=[Depends(require_api_key)], responses=ADMIN_RESPONSES
)
def list_questions(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    status: Literal["all", "active", "hidden"] = Query(
        "all", description="'active': visibles en el juego; 'hidden': ocultas; 'all': todas"
    ),
    db: Session = Depends(get_db),
):
    """Preguntas ordenadas por id, con todos sus campos (incluida la respuesta)."""
    query = db.query(Question)
    if status == "active":
        query = query.filter(Question.is_active.is_(True))
    elif status == "hidden":
        query = query.filter(Question.is_active.is_(False))
    questions = query.order_by(Question.id).offset(skip).limit(limit).all()
    return [question_to_dict(q) for q in questions]


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
            "question_es": question.question_es,
            "answer_es": question.answer_es,
            "wrong_1_es": question.wrong_1_es,
            "wrong_2_es": question.wrong_2_es,
            "wrong_3_es": question.wrong_3_es,
            "is_translated": question.is_translated,
            "is_active": question.is_active,
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
    question = db.get(Question, question_id)
    if question is None:
        raise HTTPException(status_code=404, detail="Pregunta no encontrada")
    return question_to_dict(question)


@app.get(
    "/questions/{question_id}/edits",
    dependencies=[Depends(require_api_key)],
    responses={**ADMIN_RESPONSES, **not_found("La pregunta no existe")},
)
def list_question_edits(question_id: int, db: Session = Depends(get_db)):
    """Historial de cambios de una pregunta, del más viejo al más nuevo."""
    if db.get(Question, question_id) is None:
        raise HTTPException(status_code=404, detail="Pregunta no encontrada")
    edits: list[Any] = (
        db.query(QuestionEdit)
        .filter(QuestionEdit.question_id == question_id)
        .order_by(QuestionEdit.edited_at, QuestionEdit.id)
        .all()
    )
    return [
        {
            "id": edit.id,
            "field": edit.field,
            "old_value": edit.old_value,
            "new_value": edit.new_value,
            "edited_at": edit.edited_at,
        }
        for edit in edits
    ]


@app.patch(
    "/questions/{question_id}",
    dependencies=[Depends(require_api_key)],
    responses={
        **ADMIN_RESPONSES,
        **not_found("La pregunta no existe"),
        422: {"description": "Datos inválidos, o las 4 opciones quedarían repetidas"},
    },
)
def update_question(
    question_id: int, data: QuestionUpdate, db: Session = Depends(get_db)
):
    """
    Edita una pregunta: se mandan solo los campos que cambian, en inglés o en
    español. Cada cambio queda en el historial (GET /questions/{id}/edits).

    - Las 4 opciones de cada idioma tienen que seguir siendo distintas.
    - Una pregunta sin traducir se puede traducir a mano mandando los 5 campos
      en español: queda como traducida, con translation_model "manual".
    - {"is_active": true} vuelve a mostrar una pregunta oculta.
    """
    question: Any = db.get(Question, question_id)
    if question is None:
        raise HTTPException(status_code=404, detail="Pregunta no encontrada")

    changes = data.model_dump(exclude_unset=True)

    # Cómo quedarían los textos después del cambio
    new = {f: changes.get(f, getattr(question, f)) for f in (*EN_FIELDS, *ES_FIELDS)}

    es_sent = [f for f in ES_FIELDS if f in changes]
    translating = bool(es_sent) and not question.is_translated
    if translating and len(es_sent) != len(ES_FIELDS):
        raise HTTPException(
            status_code=422,
            detail="La pregunta no está traducida: para traducirla a mano hay que "
            f"mandar los 5 campos en español ({', '.join(ES_FIELDS)})",
        )
    if not options_are_distinct([new[f] for f in EN_FIELDS[1:]]):
        raise HTTPException(
            status_code=422, detail="Las 4 opciones en inglés deben ser distintas"
        )
    if (question.is_translated or translating) and not options_are_distinct(
        [new[f] for f in ES_FIELDS[1:]]
    ):
        raise HTTPException(
            status_code=422, detail="Las 4 opciones en español deben ser distintas"
        )

    changed: list[str] = []
    for field, value in changes.items():
        old = getattr(question, field)
        if old == value:
            continue  # sin cambios: no se registra
        db.add(
            QuestionEdit(
                question_id=question.id,
                field=field,
                old_value=edit_value(old),
                new_value=edit_value(value),
            )
        )
        setattr(question, field, value)
        changed.append(field)

    if translating:
        question.is_translated = True
        question.translation_model = MANUAL_TRANSLATION

    db.commit()
    db.refresh(question)
    return {"changed_fields": changed, "question": question_to_dict(question)}


@app.delete(
    "/questions/{question_id}",
    dependencies=[Depends(require_api_key)],
    responses={**ADMIN_RESPONSES, **not_found("La pregunta no existe")},
)
def hide_question(question_id: int, db: Session = Depends(get_db)):
    """
    Oculta una pregunta: no se borra (queda con su historial), pero el juego
    ya no la muestra. Se vuelve a mostrar con PATCH {"is_active": true}.
    """
    question: Any = db.get(Question, question_id)
    if question is None:
        raise HTTPException(status_code=404, detail="Pregunta no encontrada")

    if question.is_active:
        db.add(
            QuestionEdit(
                question_id=question.id,
                field="is_active",
                old_value="true",
                new_value="false",
            )
        )
        question.is_active = False
        db.commit()
    return {"id": question_id, "is_active": False}


# --- Reportes ---


@app.post(
    "/reports",
    status_code=201,
    responses={
        **not_found("La pregunta no existe o está oculta"),
        429: {"description": f"Demasiados reportes: máximo {REPORTS_PER_MINUTE} por minuto por IP"},
    },
)
def create_report(data: ReportCreate, request: Request, db: Session = Depends(get_db)):
    """
    Un jugador reporta una pregunta con un error. Es público (no pide clave),
    pero cada IP puede mandar como máximo REPORTS_PER_MINUTE por minuto.
    No se guarda nada que identifique a quien reporta.
    """
    ip = client_ip(request)
    if not report_limiter.allow(ip):
        raise HTTPException(
            status_code=429,
            detail=f"Demasiados reportes: máximo {REPORTS_PER_MINUTE} por minuto. "
            "Probá de nuevo en unos segundos.",
            headers={"Retry-After": str(report_limiter.retry_after(ip))},
        )

    question: Any = db.get(Question, data.question_id)
    if question is None or not question.is_active:
        raise HTTPException(status_code=404, detail="Pregunta no encontrada")

    report: Any = Report(**data.model_dump(), status="pendiente")
    db.add(report)
    db.commit()
    db.refresh(report)
    return {
        "id": report.id,
        "question_id": report.question_id,
        "reason": report.reason,
        "status": report.status,
        "created_at": report.created_at,
    }


@app.get(
    "/reports",
    dependencies=[Depends(require_api_key)],
    responses=ADMIN_RESPONSES,
)
def list_reports(
    status: Literal["pendiente", "resuelto", "descartado", "todos"] = Query(
        "pendiente", description="Estado de los reportes ('todos' para no filtrar)"
    ),
    question_id: int | None = Query(None, gt=0, description="Opcional: solo los de una pregunta"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Reportes de los jugadores, del más nuevo al más viejo, con los datos de su pregunta."""
    query = db.query(Report, Question).join(Question, Question.id == Report.question_id)
    if status != "todos":
        query = query.filter(Report.status == status)
    if question_id is not None:
        query = query.filter(Report.question_id == question_id)
    rows = (
        query.order_by(Report.created_at.desc(), Report.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [report_to_dict(report, question) for report, question in rows]


@app.get(
    "/reports/stats",
    dependencies=[Depends(require_api_key)],
    responses=ADMIN_RESPONSES,
)
def report_stats(db: Session = Depends(get_db)):
    """Cantidad de reportes por estado y, entre los pendientes, por motivo."""
    by_status = dict(
        db.query(Report.status, func.count(Report.id)).group_by(Report.status).all()
    )
    pending_by_reason = dict(
        db.query(Report.reason, func.count(Report.id))
        .filter(Report.status == "pendiente")
        .group_by(Report.reason)
        .all()
    )
    return {
        "pendiente": by_status.get("pendiente", 0),
        "resuelto": by_status.get("resuelto", 0),
        "descartado": by_status.get("descartado", 0),
        "pending_by_reason": pending_by_reason,
    }


@app.patch(
    "/reports/{report_id}",
    dependencies=[Depends(require_api_key)],
    responses={**ADMIN_RESPONSES, **not_found("El reporte no existe")},
)
def update_report(report_id: int, data: ReportUpdate, db: Session = Depends(get_db)):
    """
    Cambia el estado de un reporte: resuelto (se corrigió la pregunta),
    descartado (no había error) o de vuelta a pendiente.
    """
    report: Any = db.get(Report, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")

    if report.status != data.status:
        report.status = data.status
        report.resolved_at = None if data.status == "pendiente" else utc_now()
        db.commit()
        db.refresh(report)
    question = db.get(Question, report.question_id)
    return report_to_dict(report, question)


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


@app.get("/translation/stats")
def translation_stats(db: Session = Depends(get_db)):
    """Cuántas preguntas están traducidas al español y con qué modelo."""
    total = db.query(func.count(Question.id)).scalar() or 0
    translated = (
        db.query(func.count(Question.id))
        .filter(Question.is_translated.is_(True))
        .scalar()
        or 0
    )
    models = [
        name
        for (name,) in db.query(Question.translation_model)
        .filter(Question.translation_model.is_not(None))
        .distinct()
        .all()
    ]
    return {
        "total_questions": total,
        "translated": translated,
        "untranslated": total - translated,
        "percentage_translated": round(translated / total * 100, 2) if total else 0.0,
        "models_used": models,
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