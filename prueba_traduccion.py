"""
Prueba rápida de la API en español e inglés (paso 8 de la consigna de
traducción). Requiere la API corriendo:

    poetry run uvicorn app.main:app --reload

Uso (en otra terminal):
    poetry run python prueba_traduccion.py

No se llama test_api.py como en la consigna: pytest toma como test
cualquier archivo test_*.py, y este necesita la API levantada.
"""
import requests

API_URL = "http://localhost:8000"


def show_question(lang: str) -> dict:
    question = requests.get(
        f"{API_URL}/game/question", params={"lang": lang}, timeout=10
    ).json()
    print(f"P ({question['lang']}): {question['question']}")
    for option in question["options"]:
        print(f"   - {option}")
    return question


def main() -> None:
    print("--- Pregunta en español (por defecto) ---")
    question = show_question("es")

    # Respondemos la primera opción y pedimos la correcta en los dos idiomas
    body = {"question_id": question["id"], "answer": question["options"][0]}
    for lang in ("es", "en"):
        result = requests.post(
            f"{API_URL}/game/answer", params={"lang": lang}, json=body, timeout=10
        ).json()
        print(
            f"Respuesta correcta ({lang}): {result['correct_answer']}  "
            f"(¿acertó con '{body['answer']}'? {'sí' if result['correct'] else 'no'})"
        )

    print("\n--- Pregunta en inglés ---")
    show_question("en")

    print("\n--- Estadísticas de traducción ---")
    print(requests.get(f"{API_URL}/translation/stats", timeout=10).json())


if __name__ == "__main__":
    try:
        main()
    except requests.ConnectionError:
        print(f"No se pudo conectar con la API en {API_URL}. ¿Está levantada?")
        print("Levantarla con: poetry run uvicorn app.main:app --reload")