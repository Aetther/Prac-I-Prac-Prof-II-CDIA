"""
Script principal de categorización.

Orquesta todo el flujo:
1. Carga las preguntas sin categorizar de la BD
2. Las clasifica con la IA (en tandas, para aprovechar la GPU),
   usando la pregunta junto con su respuesta correcta como contexto
3. Si el score >= threshold → guarda automáticamente
4. Si el score < threshold → pide revisión humana
5. Guarda el resultado en la tabla categorizations

Uso:
    poetry run python -m app.categorize --limit 20
    poetry run python -m app.categorize --no-review
    poetry run python -m app.categorize --auto-only   (equivale a --no-review)
"""
import argparse
from typing import Any

from sqlalchemy import func, select
from tqdm import tqdm

from app.categories import (
    CATEGORIES,
    find_category_by_name,
    get_category_descriptions,
    get_category_names,
)
from app.classifier import AIClassifier, build_input_text
from app.database import SessionLocal
from app.human_review import (
    ask_human_for_category,
    confirm_ai_suggestion,
    display_question_context,
)
from app.models import Categorization, Question

# Umbral de confianza (70%)
CONFIDENCE_THRESHOLD = 0.70

# Cantidad de preguntas que se clasifican juntas antes de guardarlas
CHUNK_SIZE = 256


def get_uncategorized_questions(db, limit: int | None = None) -> list:
    """
    Obtiene las preguntas que aún no tienen una categorización,
    en orden aleatorio para que una muestra incluya todas las categorías.
    """
    categorized_ids = select(Categorization.question_id)
    query = (
        db.query(Question)
        .filter(~Question.id.in_(categorized_ids))
        .order_by(func.random())
    )
    if limit:
        query = query.limit(limit)
    return query.all()


def save_categorization(
    db,
    question_id: int,
    category_name: str,
    confidence_score: float,
    is_automatic: bool,
) -> None:
    """Guarda una categorización en la base de datos."""
    try:
        db.add(
            Categorization(
                question_id=question_id,
                category_name=category_name,
                confidence_score=confidence_score,
                is_automatic=is_automatic,
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        raise


def categorize_all(
    batch_size: int = 16,
    threshold: float = CONFIDENCE_THRESHOLD,
    limit: int | None = None,
    review: bool = True,
) -> None:
    """Ejecuta el flujo completo de categorización."""
    db = SessionLocal()

    # Al modelo le pasamos las descripciones; después las traducimos a nombres
    descriptions = get_category_descriptions()
    desc_to_name = dict(zip(descriptions, get_category_names()))

    automatic = manual = skipped = matches = 0

    try:
        questions = get_uncategorized_questions(db, limit)
        if not questions:
            print("No hay preguntas pendientes de categorizar.")
            return

        # Copiamos los datos a tuplas simples. Si usáramos los objetos Question
        # después de cada commit, SQLAlchemy los volvería a consultar uno por uno.
        rows: list[Any] = [
            (q.id, q.question, q.answer, q.category) for q in questions
        ]

        print()
        print(f"Preguntas pendientes:  {len(rows)}")
        print(f"Categorías:            {', '.join(get_category_names())}")
        print(f"Umbral de confianza:   {threshold:.0%}")
        print(f"Revisión humana:       {'activada' if review else 'desactivada'}")
        print()

        classifier = AIClassifier()

        with tqdm(total=len(rows), desc="Categorizando", unit="preg") as bar:
            for start in range(0, len(rows), CHUNK_SIZE):
                chunk = rows[start : start + CHUNK_SIZE]
                # El modelo ve la pregunta junto con su respuesta correcta
                results = classifier.classify_batch(
                    [build_input_text(text, answer) for _, text, answer, _ in chunk],
                    descriptions,
                    batch_size,
                )

                for (question_id, text, answer, original_label), result in zip(chunk, results):
                    suggestion = desc_to_name[result.category_name]
                    scores = {desc_to_name[d]: s for d, s in result.all_scores.items()}
                    confidence = result.confidence_score

                    if confidence >= threshold:
                        chosen, is_automatic = suggestion, True
                    elif not review:
                        chosen, is_automatic = None, False
                    else:
                        # Ocultamos la barra de progreso mientras la persona responde.
                        # Le mostramos la pregunta y la respuesta: el mismo contexto
                        # que recibe la IA.
                        with tqdm.external_write_mode():
                            display_question_context(
                                text, suggestion, confidence, scores, answer
                            )
                            if confirm_ai_suggestion(suggestion, confidence):
                                chosen = suggestion
                            else:
                                chosen = ask_human_for_category(CATEGORIES, scores)
                        is_automatic = False

                    if chosen is None:
                        skipped += 1
                    else:
                        save_categorization(db, question_id, chosen, confidence, is_automatic)
                        if is_automatic:
                            automatic += 1
                        else:
                            manual += 1

                        category = find_category_by_name(chosen)
                        if category and category["label"] == original_label:
                            matches += 1

                    bar.update(1)

    except KeyboardInterrupt:
        print("\n\nInterrumpido por el usuario. Lo guardado hasta ahora se conserva.")
    finally:
        db.close()

    saved = automatic + manual
    print()
    print("═" * 40)
    print("RESUMEN")
    print("═" * 40)
    print(f"Procesadas:   {saved + skipped}")
    print(f"Automáticas:  {automatic}")
    print(f"Manuales:     {manual}")
    print(f"Salteadas:    {skipped}")
    if saved:
        print(f"Coinciden con la categoría del dataset: {matches}/{saved} ({matches / saved:.0%})")
    print("═" * 40)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Categoriza preguntas con IA + revisión humana")
    parser.add_argument("--limit", type=int, default=None,
                        help="Cantidad máxima de preguntas a procesar (al azar)")
    parser.add_argument("--threshold", type=float, default=CONFIDENCE_THRESHOLD,
                        help="Umbral de confianza para decisión automática (0 a 1)")
    parser.add_argument("--batch-size", type=int, default=16,
                        help="Preguntas que procesa la GPU en paralelo")
    parser.add_argument("--no-review", "--auto-only", action="store_true",
                        help="No pedir revisión humana: saltea las de baja confianza")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    categorize_all(
        batch_size=args.batch_size,
        threshold=args.threshold,
        limit=args.limit,
        review=not args.no_review,
    )