from fastapi import FastAPI, Depends, HTTPException, Body
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import get_db, engine
from app.models import Base, Question

app = FastAPI(title="Questions API", version="1.0.0")

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
            "/questions/category/{category}",
            "/stats",
            "POST /questions",
        ],
    }


@app.get("/questions")
def list_questions(skip: int = 0, limit: int = 10, db: Session = Depends(get_db)):
    questions = db.query(Question).offset(skip).limit(limit).all()
    return questions


@app.get("/questions/category/{category}")
def list_questions_by_category(
    category: str, skip: int = 0, limit: int = 10, db: Session = Depends(get_db)
):
    questions = (
        db.query(Question)
        .filter(func.lower(Question.category) == category.lower())
        .offset(skip)
        .limit(limit)
        .all()
    )
    if not questions:
        raise HTTPException(
            status_code=404, detail=f"No hay preguntas para la categoría '{category}'"
        )
    return questions


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