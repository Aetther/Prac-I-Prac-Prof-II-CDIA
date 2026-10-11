from fastapi import Body, Depends, FastAPI, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.categories import CATEGORIES, find_category_by_name
from app.database import engine, get_db
from app.models import Base, Categorization, Question

app = FastAPI(title="Questions API", version="1.0.0")

# Campos obligatorios para crear una pregunta
REQUIRED_FIELDS = ["question", "answer", "wrong_1", "wrong_2", "wrong_3", "category"]


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)


@app.get("/")
def root():
    return {
        "message": "Questions API funcionando",
        "endpoints": [
            "/questions",
            "/questions/{id}",
            "/questions/category/{category_name}",
            "/stats",
            "/categories",
            "/categories/stats",
            "POST /questions",
        ],
    }


@app.get("/questions")
def list_questions(skip: int = 0, limit: int = 10, db: Session = Depends(get_db)):
    questions = db.query(Question).offset(skip).limit(limit).all()
    return questions


@app.get("/questions/category/{category_name}")
def list_by_category(
    category_name: str, skip: int = 0, limit: int = 10, db: Session = Depends(get_db)
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


@app.get("/questions/{question_id}")
def get_question(question_id: int, db: Session = Depends(get_db)):
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        return {"error": "Pregunta no encontrada"}
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


@app.post("/questions", status_code=201)
def create_question(data: dict = Body(...), db: Session = Depends(get_db)):
    missing = [f for f in REQUIRED_FIELDS if not str(data.get(f, "")).strip()]
    if missing:
        raise HTTPException(
            status_code=400, detail=f"Faltan campos: {', '.join(missing)}"
        )

    values = {f: str(data[f]).strip() for f in REQUIRED_FIELDS}

    options = [values["answer"], values["wrong_1"], values["wrong_2"], values["wrong_3"]]
    if len({o.lower() for o in options}) != 4:
        raise HTTPException(
            status_code=400, detail="Las 4 opciones deben ser distintas"
        )

    question = Question(**values, source=data.get("source") or "manual")
    db.add(question)
    db.commit()
    db.refresh(question)
    return question