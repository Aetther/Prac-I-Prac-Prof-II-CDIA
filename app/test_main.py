from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_read_root():
    """Prueba que la ruta raíz responda con éxito y traiga el mensaje correcto"""
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["message"] == "Questions API funcionando"


def test_read_questions_list():
    """Prueba que el listado de preguntas devuelva una lista de datos"""
    response = client.get("/questions?limit=5")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_get_invalid_question():
    """Prueba el comportamiento cuando buscamos un ID de pregunta que no existe"""
    response = client.get("/questions/999999")
    assert response.status_code == 200
    assert "error" in response.json()
    assert response.json()["error"] == "Pregunta no encontrada"


def test_create_question():
    """Prueba que el endpoint POST cree una pregunta correctamente"""
    new_question_payload = {
        "question": "¿De qué color es el caballo blanco de San Martín?",
        "answer": "Blanco",
        "category": "Trivia",
        "source": "Test Automatizado",
    }
    response = client.post("/questions", json=new_question_payload)
    assert response.status_code == 201
    assert response.json()["message"] == "Pregunta creada exitosamente"
    assert "id" in response.json()["question"]
