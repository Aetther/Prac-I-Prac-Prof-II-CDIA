from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from app.database import get_db, engine
from app.models import Base, Question
from sqlalchemy import func
from pydantic import BaseModel

class QuestionCreate(BaseModel):
    question: str
    answer: str
    category: str | None = None
    source: str | None = None

app = FastAPI(title="Questions API", version="1.0.0")


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)


@app.get("/")
def root():
    return {"message": "Questions API funcionando", "endpoints": ["/questions", "/questions/{id}"]}


@app.get("/questions")
def list_questions(skip: int = 0, limit: int = 10, db: Session = Depends(get_db)):
    questions = db.query(Question).offset(skip).limit(limit).all()
    return questions


@app.get("/questions/{question_id}")
def get_question(question_id: int, db: Session = Depends(get_db)):
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        return {"error": "Pregunta no encontrada"}
    return question

@app.get("/questions/category/{category}")
def get_questions_by_category(category: str, db: Session = Depends(get_db)):
    questions = db.query(Question).filter(Question.category == category).all()
    if not questions:
        return {"message": f"No se encontraron preguntas para la categoría: {category}"}
    return questions

@app.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    total_questions = db.query(Question).count()

    category_counts = (
        db.query(Question.category, func.count(Question.id))
        .group_by(Question.category)
        .all()
    )

    by_category = {category: count for category, count in category_counts if category is not None}

    return {
        "total_questions": total_questions,
        "questions_by_category": by_category
    }

@app.post("/questions", status_code=201)
def create_question(question_data: QuestionCreate, db: Session = Depends(get_db)):
    new_question = Question(
        question=question_data.question,
        answer=question_data.answer,
        category=question_data.category,
        source=question_data.source,
    )
    
    db.add(new_question)
    db.commit()
    db.refresh(new_question)
    
    return {
        "message": "Pregunta creada exitosamente",
        "question": new_question
    }

