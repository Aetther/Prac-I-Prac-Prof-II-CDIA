def display_question_context(
    question_text: str,
    ai_suggestion: str,
    confidence: float,
    all_scores: dict[str, float]
) -> None:
    print("═" * 64)
    print("REVISIÓN MANUAL REQUERIDA (confianza < 70%)")
    print("═" * 64)

    print(f"Pregunta: {question_text}")
    print(
        f"Sugerencia de la IA: {ai_suggestion} "
        f"(confianza: {confidence:.0%})"
    )

    print("Scores de todas las categorías:")

    sorted_scores = sorted(
        all_scores.items(),
        key=lambda item: item[1],
        reverse=True
    )

    for index, (category, score) in enumerate(sorted_scores, start=1):
        print(f"  {index}. {category} → {score:.0%}")

    print("═" * 64)

def ask_human_for_category(categories: list[dict]) -> str | None:
    print("\nSeleccioná la categoría correcta:")

    for index, category in enumerate(categories, start=1):
        print(f"  {index}. {category['name']}")

    print("  S. Omitir esta pregunta")

    while True:
        choice = input("\nTu elección: ").strip()

        if choice.lower() == "s":
            return None

        if choice.isdigit():
            index = int(choice)

            if 1 <= index <= len(categories):
                return categories[index - 1]["name"]

        print("Opción inválida. Elegí un número válido o S para omitir.")

def confirm_ai_suggestion(
    ai_suggestion: str,
    confidence: float
) -> bool:
    print(
        f"\n¿Aceptar la sugerencia de la IA: "
        f"'{ai_suggestion}' ({confidence:.0%})?"
    )
    print("  Enter/S = Sí")
    print("  N = No")

    choice = input("Tu elección: ").strip().lower()

    if choice in ("", "s"):
        return True

    if choice == "n":
        return False

    print("Opción inválida. Se tomará como No.")
    return False