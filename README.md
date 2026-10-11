# Questions API

API de preguntas de trivia estilo *Preguntados*, construida con **FastAPI**, **SQLAlchemy** y **PostgreSQL**. Las preguntas se cargan desde un dataset de Hugging Face.

Proyecto de Práctica Profesional II — CDIA.

## Tecnologías

- **Python 3.13** con **Poetry** para el manejo de dependencias
- **FastAPI** + **Uvicorn** para la API
- **SQLAlchemy** como ORM
- **PostgreSQL** en un contenedor de **Docker**
- **pandas** + **pyarrow** para leer el dataset en formato Parquet
- **pytest** + **httpx** para los tests

## Estructura del proyecto

```
├── app/
│   ├── __init__.py
│   ├── database.py      # Conexión a la base de datos y sesión
│   ├── models.py        # Modelo Question (tabla questions)
│   ├── load_data.py     # Descarga el dataset y lo carga en la base
│   └── main.py          # Endpoints de la API
├── tests/
│   └── test_api.py      # Tests de los endpoints
├── docker-compose.yml   # Servicio de PostgreSQL
└── pyproject.toml       # Dependencias y configuración
```

## Cómo ejecutarlo

Todos los comandos se ejecutan desde la raíz del proyecto.

1. Instalar las dependencias:
   ```bash
   poetry install
   ```

2. Levantar la base de datos:
   ```bash
   docker compose up -d
   ```

3. Cargar las preguntas (crea la tabla y la llena con el dataset):
   ```bash
   poetry run python -m app.load_data
   ```

4. Iniciar la API:
   ```bash
   poetry run uvicorn app.main:app --reload
   ```

La API queda disponible en `http://localhost:8000` y la documentación interactiva en `http://localhost:8000/docs`.

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/` | Estado de la API y lista de endpoints |
| GET | `/questions` | Lista de preguntas, paginada con `skip` y `limit` |
| GET | `/questions/{id}` | Una pregunta por su id |
| GET | `/questions/category/{category}` | Preguntas de una categoría (sin distinguir mayúsculas), paginadas con `skip` y `limit`. Devuelve 404 si no hay resultados |
| GET | `/stats` | Total de preguntas y cantidad por categoría |
| POST | `/questions` | Crea una pregunta nueva. Devuelve 201 si se creó y 400 si faltan campos o hay opciones repetidas |

Ejemplo de cuerpo para `POST /questions`:

```json
{
  "question": "¿Cuál es la capital de Chaco?",
  "answer": "Resistencia",
  "wrong_1": "Corrientes",
  "wrong_2": "Formosa",
  "wrong_3": "Posadas",
  "category": "Geografía"
}
```

## Dataset

### Cambio de dataset

El dataset original propuesto en el ejercicio no estaba disponible (es privado), y además solo tenía pregunta y respuesta. Para una app tipo Preguntados se necesitan **opciones incorrectas** para que el usuario elija, así que se reemplazó por:

**[kth8/OpenTriviaQA](https://huggingface.co/datasets/kth8/OpenTriviaQA)**: unas 49.600 preguntas de trivia de opción múltiple, en formato Parquet. Es una versión del proyecto [OpenTriviaQA](https://github.com/uberspot/OpenTriviaQA), publicada en Hugging Face bajo licencia CC BY 4.0.

Cada fila del dataset original tiene:

- `category`: categoría temática
- `question`: la pregunta
- `choices`: lista de opciones (incluye la correcta)
- `answer`: la respuesta correcta

### Transformaciones aplicadas (`app/load_data.py`)

1. **Filtrado por cantidad de opciones:** se conservan solo las preguntas con la respuesta correcta y exactamente 3 opciones incorrectas. Así se descartan las de Verdadero/Falso.
2. **Separación de opciones:** las incorrectas se guardan en columnas propias (`wrong_1`, `wrong_2`, `wrong_3`), separadas de la correcta (`answer`).
3. **Mapeo de categorías:** las categorías originales se agrupan en las 6 de Preguntados. Las que no encajan (por ejemplo *celebrities* o *rated*) se descartan.

| Categoría | Categorías originales |
|---|---|
| Geografía | geography, world |
| Historia | history |
| Ciencia | science-technology, animals |
| Arte | literature, humanities |
| Entretenimiento | movies, music, television, video-games |
| Deportes | sports |

### Resultado

De 49.599 preguntas originales quedaron **26.867** válidas:

| Categoría | Preguntas |
|---|---:|
| Arte | 2.033 |
| Ciencia | 3.118 |
| Deportes | 2.394 |
| Entretenimiento | 12.992 |
| Geografía | 4.892 |
| Historia | 1.438 |

Las categorías quedan desbalanceadas: Entretenimiento concentra casi la mitad. Para que el juego sea parejo, conviene elegir primero la categoría (como la ruleta de Preguntados) y después una pregunta al azar dentro de ella.

Las preguntas están en inglés.

## Tests

```bash
poetry run pytest -v
```

Los tests usan una base **SQLite en memoria** que reemplaza a PostgreSQL mediante `dependency_overrides` de FastAPI. No tocan los datos reales ni necesitan Docker levantado. Cubren el filtro por categoría, las estadísticas y la creación de preguntas, tanto en los casos válidos como en los de error.
