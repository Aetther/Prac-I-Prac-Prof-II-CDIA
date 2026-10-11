"""
Módulo de revisión humana por consola.

Cuando la IA no tiene suficiente confianza (score < threshold),
este módulo le pregunta al usuario por terminal qué categoría corresponde.
"""
from app.categories import find_category_by_name

LINE = "═" * 64


def _label(name: str) -> str:
    """Devuelve el label legible de una categoría, o el name si no se encuentra."""
    category = find_category_by_name(name)
    return category["label"] if category else name


def display_question_context(
    question_text: str,
    ai_suggestion: str,
    confidence: float,
    all_scores: dict[str, float],
    answer: str | None = None,
) -> None:
    """Muestra al usuario la pregunta, la sugerencia de la IA y los scores."""
    print()
    print(LINE)
    print("REVISIÓN MANUAL REQUERIDA (confianza < 70%)")
    print(LINE)
    print()
    print(f"Pregunta:  {question_text}")
    if answer:
        print(f"Respuesta: {answer}")
    print()
    print(f"Sugerencia de la IA: {_label(ai_suggestion)} (confianza: {confidence:.0%})")
    print()
    print("Scores de todas las categorías:")

    ranking = sorted(all_scores.items(), key=lambda item: item[1], reverse=True)
    for position, (name, score) in enumerate(ranking, start=1):
        print(f"  {position}. {_label(name):<16} → {score:.0%}")

    print()
    print(LINE)

def confirm_ai_suggestion(ai_suggestion: str, confidence: float) -> bool:
    """
    Pregunta al usuario si acepta la sugerencia de la IA.
    Enter o "S" = acepta, "N" = no acepta.
    """
    while True:
        answer = input(
            f'¿Aceptás la sugerencia "{_label(ai_suggestion)}" ({confidence:.0%})? [S/n]: '
        ).strip().lower()

        if answer in ("", "s", "si", "sí"):
            return True
        if answer in ("n", "no"):
            return False
        print("Respuesta no válida. Escribí S (sí) o N (no).")


def ask_human_for_category(
    categories: list[dict[str, str]],
    scores: dict[str, float] | None = None,
) -> str | None:
    """
    Le pide al usuario que elija una categoría por consola.

    Args:
        categories: lista de categorías (cada una con "name" y "label")
        scores: opcional. Si se pasa, las opciones se ordenan de mayor a menor
                score, en el mismo orden en que se mostraron en el ranking.

    Returns:
        El "name" de la categoría elegida, o None si el usuario eligió skip.
    """
    if scores:
        categories = sorted(
            categories, key=lambda c: scores.get(c["name"], 0.0), reverse=True
        )

    print()
    print("Opciones:")
    for number, category in enumerate(categories, start=1):
        print(f"  {number}. {category['label']}")
    print("  S. Skip (omitir esta pregunta)")
    print()

    while True:
        answer = input("Elegí una opción: ").strip().lower()

        if answer == "s":
            return None
        if answer.isdigit() and 1 <= int(answer) <= len(categories):
            return categories[int(answer) - 1]["name"]

        print(f"Opción no válida. Escribí un número del 1 al {len(categories)} o S.")


if __name__ == "__main__":
    # Prueba manual con el caso en que la IA dudó: la Capilla Sixtina.
    from app.categories import CATEGORIES

    scores = {
        "historia": 0.42,
        "arte": 0.35,
        "geografia": 0.10,
        "ciencia": 0.06,
        "entretenimiento": 0.05,
        "deportes": 0.02,
    }

    display_question_context(
        "Who painted the ceiling of the Sistine Chapel?", "historia", 0.42, scores
    )

    if confirm_ai_suggestion("historia", 0.42):
        print("→ Se guardaría: historia")
    else:
        chosen = ask_human_for_category(CATEGORIES, scores)
        print(f"→ Se guardaría: {chosen}" if chosen else "→ Pregunta salteada")