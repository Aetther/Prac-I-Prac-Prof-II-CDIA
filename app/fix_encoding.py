"""
Repara caracteres mal codificados en las preguntas del dataset.

El dataset original tiene texto con errores de codificación: por ejemplo,
"Queenâ\x80\x99s" en lugar de "Queen's". Algunos de esos caracteres son
códigos de control que pueden incluso trabar la terminal.

ftfy ("fixes text for you") detecta y repara este tipo de errores.

Uso:
    poetry run python -m app.fix_encoding
"""
from ftfy import fix_text

from app.database import SessionLocal
from app.models import Question

TEXT_FIELDS = ["question", "answer", "wrong_1", "wrong_2", "wrong_3"]


def main() -> None:
    db = SessionLocal()
    fixed_questions = 0
    fixed_fields = 0
    try:
        for question in db.query(Question).all():
            changed = False
            for field in TEXT_FIELDS:
                original = getattr(question, field)
                repaired = fix_text(original)
                if repaired != original:
                    setattr(question, field, repaired)
                    fixed_fields += 1
                    changed = True
            if changed:
                fixed_questions += 1
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    print(f"Preguntas reparadas: {fixed_questions}")
    print(f"Campos reparados:    {fixed_fields}")


if __name__ == "__main__":
    main()