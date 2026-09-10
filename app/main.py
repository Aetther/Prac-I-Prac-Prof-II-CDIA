from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from app.database import get_db, engine
from app.models import Base, Question, Categorization
from sqlalchemy import func
from pydantic import BaseModel
from app.categories import CATEGORIES

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

@app.get("/questions/category/{category_name}")
def list_by_category(
    category_name: str,
    skip: int = 0,
    limit: int = 10,
    db: Session = Depends(get_db)
):
    results = (
        db.query(Question, Categorization)
        .join(Categorization, Question.id == Categorization.question_id)
        .filter(Categorization.category_name == category_name)
        .offset(skip)
        .limit(limit)
        .all()
    )

    return [
        {
            "question": question,
            "categorization": categorization
        }
        for question, categorization in results
    ]

@app.get("/categories")
def list_categories():
    return CATEGORIES

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

@app.get("/categories/stats")
def category_stats(db: Session = Depends(get_db)):
    total_questions = db.query(Question).count()

    categorized = (
        db.query(Categorization.question_id)
        .distinct()
        .count()
    )

    uncategorized = total_questions - categorized

    automatic = (
        db.query(Categorization)
        .filter(Categorization.is_automatic == True)
        .count()
    )

    manual = (
        db.query(Categorization)
        .filter(Categorization.is_automatic == False)
        .count()
    )

    category_counts = (
        db.query(
            Categorization.category_name,
            func.count(Categorization.id)
        )
        .group_by(Categorization.category_name)
        .all()
    )

    by_category = {
        category: count
        for category, count in category_counts
    }

    return {
        "total_questions": total_questions,
        "categorized": categorized,
        "uncategorized": uncategorized,
        "automatic": automatic,
        "manual": manual,
        "by_category": by_category
    }
