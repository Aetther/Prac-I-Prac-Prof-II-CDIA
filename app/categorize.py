"""
Script principal de categorización.

Orquesta todo el flujo:

1. Carga las preguntas sin categorizar de la BD
2. Para cada pregunta, la clasifica con la IA
3. Si el score >= threshold → guarda automáticamente
4. Si el score < threshold → pide revisión humana
5. Guarda el resultado en la tabla categorizations

Las categorías se presentan al modelo en inglés para mejorar
la compatibilidad con el modelo BART, mientras que los nombres
internos en español se conservan en la base de datos.
"""

from tqdm import tqdm

from app.models import Question, Categorization
from app.database import SessionLocal
from app.categories import CATEGORIES
from app.classifier import AIClassifier
from app.human_review import (
display_question_context,
ask_human_for_category,
confirm_ai_suggestion,
)

# Umbral de confianza (70%)

CONFIDENCE_THRESHOLD = 0.70

def get_uncategorized_questions(db) -> list:
    """
    Obtiene todas las preguntas que aún no tienen una categorización.
    """
    subquery = db.query(Categorization.question_id)

    questions = (
    db.query(Question)
    .filter(~Question.id.in_(subquery))
    .all()
)

    return questions

def save_categorization(
    db,
    question_id: int,
    category_name: str,
    confidence_score: float,
    is_automatic: bool
) -> None:
    """
    Guarda una categorización en la base de datos.
    """
    try:
        categorization = Categorization(
            question_id=question_id,
            category_name=category_name,
            confidence_score=confidence_score,
            is_automatic=is_automatic
        )

        db.add(categorization)
        db.commit()
    except Exception:
        db.rollback()
        raise

def categorize_all(
    batch_size: int = 32,
    threshold: float = CONFIDENCE_THRESHOLD
) -> None:
    """
    Función principal que ejecuta el flujo completo de categorización.
    """

    db = SessionLocal()

    try:
        # ---------------------------------------------------------
        # Preparar categorías para la IA
        # ---------------------------------------------------------

        # Mapeo entre el nombre que usa la IA y el nombre interno
        # que utilizamos en la base de datos.
        category_names = {
            category["label"]: category["name"]
            for category in CATEGORIES
        }

        # La IA recibe los labels y las descripciones en inglés.
        category_labels = [
            f"{category['label']}: {category['description']}"
            for category in CATEGORIES
        ]

        # Instanciar clasificador
        classifier = AIClassifier()

        # Obtener preguntas sin categorizar
        questions = get_uncategorized_questions(db)

        # Mostrar resumen inicial
        print("\n" + "=" * 64)
        print("SISTEMA DE CATEGORIZACIÓN CON IA")
        print("=" * 64)
        print(f"Preguntas pendientes: {len(questions)}")
        print(
            "Categorías disponibles: "
            + ", ".join(
                category["label"]
                for category in CATEGORIES
            )
        )
        print(f"Umbral de confianza: {threshold:.0%}")
        print("=" * 64)

        automatic_count = 0
        manual_count = 0
        skipped_count = 0

        # ---------------------------------------------------------
        # Procesar preguntas
        # ---------------------------------------------------------

        for question in tqdm(
            questions,
            desc="Categorizando preguntas"
        ):
            result = classifier.classify(
                question.question,
                category_labels
            )

            # Convertir la categoría de la IA al nombre interno
            ai_category_label = result.category_name

            internal_category_name = category_names.get(
                ai_category_label
            )

            # Si el modelo devuelve el texto completo en lugar
            # del label exacto, buscamos por el comienzo.
            if internal_category_name is None:
                for category in CATEGORIES:
                    if ai_category_label.startswith(
                        category["label"]
                    ):
                        internal_category_name = category["name"]
                        break

            # Evitar guardar una categoría desconocida.
            if internal_category_name is None:
                raise ValueError(
                    "La IA devolvió una categoría no reconocida: "
                    f"{ai_category_label}"
                )

            # -----------------------------------------------------
            # Clasificación automática
            # -----------------------------------------------------

            if result.confidence_score >= threshold:
                save_categorization(
                    db=db,
                    question_id=question.id,
                    category_name=internal_category_name,
                    confidence_score=result.confidence_score,
                    is_automatic=True
                )

                automatic_count += 1

            # -----------------------------------------------------
            # Revisión manual
            # -----------------------------------------------------

            else:
                display_question_context(
                    question_text=question.question,
                    ai_suggestion=ai_category_label,
                    confidence=result.confidence_score,
                    all_scores=result.all_scores
                )

                accepted = confirm_ai_suggestion(
                    ai_suggestion=ai_category_label,
                    confidence=result.confidence_score
                )

                if accepted:
                    save_categorization(
                        db=db,
                        question_id=question.id,
                        category_name=internal_category_name,
                        confidence_score=result.confidence_score,
                        is_automatic=False
                    )

                    manual_count += 1

                else:
                    selected_category = ask_human_for_category(
                        CATEGORIES
                    )

                    if selected_category is None:
                        skipped_count += 1
                        continue

                    save_categorization(
                        db=db,
                        question_id=question.id,
                        category_name=selected_category,
                        confidence_score=result.confidence_score,
                        is_automatic=False
                    )

                    manual_count += 1

        # ---------------------------------------------------------
        # Resumen final
        # ---------------------------------------------------------

        total_processed = automatic_count + manual_count

        print("\n" + "=" * 64)
        print("CATEGORIZACIÓN FINALIZADA")
        print("=" * 64)
        print(f"Total procesadas: {total_processed}")
        print(f"Automáticas: {automatic_count}")
        print(f"Manuales: {manual_count}")
        print(f"Skipped: {skipped_count}")
        print("=" * 64)

    finally:
        db.close()


if __name__ == "__main__":
    categorize_all()
