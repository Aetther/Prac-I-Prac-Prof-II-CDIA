# Questions API — Trivia estilo Preguntados con categorización y traducción por IA

![Python](https://img.shields.io/badge/Python-3.13-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-API-009688?logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Docker-4169E1?logo=postgresql&logoColor=white)
![Hugging Face](https://img.shields.io/badge/Hugging%20Face-Transformers-FFD21E?logo=huggingface&logoColor=black)
![Tests](https://img.shields.io/badge/tests-200-brightgreen?logo=pytest&logoColor=white)

API de preguntas de trivia estilo *Preguntados*, construida con **FastAPI**, **SQLAlchemy** y **PostgreSQL**. Las preguntas se cargan desde un dataset de Hugging Face, se categorizan con un modelo de IA (*zero-shot classification*), con **revisión humana** (*Human-in-the-Loop*) para los casos en que la IA no está segura, y se **traducen al español** con un modelo de traducción automática. Se puede jugar en español o en inglés.

Proyecto de Práctica Profesional II — CDIA.

## Índice

1. [Visión general](#visión-general)
2. [Tecnologías](#tecnologías)
3. [Estructura del proyecto](#estructura-del-proyecto)
4. [Base de datos](#base-de-datos)
5. [Requisitos](#requisitos)
6. [Instalación y puesta en marcha](#instalación-y-puesta-en-marcha)
7. [Uso de GPU (opcional)](#uso-de-gpu-opcional)
8. [API](#api)
9. [Dataset](#dataset)
10. [Categorización con IA](#categorización-con-ia)
11. [Traducción con IA](#traducción-con-ia)
12. [Scripts](#scripts)
13. [Resultados](#resultados)
14. [Tests](#tests)
15. [Seguridad](#seguridad)
16. [Problemas frecuentes](#problemas-frecuentes)
17. [Limitaciones conocidas y posibles mejoras](#limitaciones-conocidas-y-posibles-mejoras)
18. [Créditos y licencias](#créditos-y-licencias)

---

## Visión general

Flujo completo del backend: las preguntas se cargan, se categorizan con IA (con revisión humana cuando la IA no está segura), se traducen al español y quedan disponibles en la API.

```mermaid
flowchart LR
    A[Hugging Face<br/>OpenTriviaQA] -->|load_data| B[(Preguntas)]
    C[training_data.csv<br/>decisiones humanas] -->|restore_decisions| D[(Categorizaciones)]
    B --> E{IA zero-shot<br/>confianza ≥ 70%?}
    E -->|Sí| F[Automática]
    E -->|No| G[Revisión humana]
    G -->|Acepta o corrige| H[Manual]
    G -->|Saltea| I[Queda pendiente]
    F --> D
    H --> D
    D -->|translate_questions| K[Pregunta sola]
    D --> L["Cada opción<br/>con su pregunta"]
    K --> M[Modelo MarianMT<br/>opus-mt-en-es]
    L --> M
    M --> N["Postprocesamiento<br/>agrega los signos ¿ y ¡<br/>y extrae la opción"]
    N --> O{¿Las 4 opciones<br/>siguen distintas?}
    O -->|Sí| P[(Preguntas en<br/>inglés y español)]
    O -->|No| Q[Queda en inglés]
    P --> R[API FastAPI]
    Q --> R
```

1. **Carga** (`load_data`): descarga el dataset en una versión fija, verifica que el archivo sea el esperado, repara la codificación, se queda con las preguntas de 4 opciones y elimina duplicados. Ver [Dataset](#dataset).
2. **Decisiones humanas** (`restore_decisions`): recupera las categorizaciones que revisó una persona, guardadas en el repositorio. Las nuevas se exportan con `export_training`.
3. **Categorización** (`categorize`): la IA asigna una de las 6 categorías. Si está segura (≥ 70%), se guarda sola; si no, decide una persona o la pregunta queda pendiente. Ver [Categorización con IA](#categorización-con-ia).
4. **Traducción** (`translate_questions`): la IA traduce cada pregunta y sus opciones al español, sin tocar el inglés. Ver [Traducción con IA](#traducción-con-ia).
5. **API**: el juego entrega preguntas categorizadas, en el idioma pedido y sin revelar la respuesta hasta que el jugador elige. Ver [API](#api).

## Tecnologías

| Área | Herramientas |
|---|---|
| Lenguaje y dependencias | Python 3.13, Poetry |
| API | FastAPI, Uvicorn |
| Base de datos | PostgreSQL (en Docker), SQLAlchemy |
| Datos | pandas, pyarrow, requests, ftfy |
| IA | transformers, PyTorch, sentence-transformers, scikit-learn, SetFit |
| Traducción | transformers (MarianMT), sentencepiece, sacremoses |
| Tests | pytest, httpx |

## Estructura del proyecto

```
├── app/
│   ├── __init__.py
│   ├── main.py                     # Endpoints de la API
│   ├── schemas.py                  # Validación de los datos que recibe la API (Pydantic)
│   ├── database.py                 # Conexión a PostgreSQL y sesión
│   ├── models.py                   # Tablas: questions (con traducción) y categorizations
│   ├── load_data.py                # Descarga, limpia y carga el dataset
│   ├── categories.py               # Las 6 categorías y sus descripciones
│   ├── classifier.py               # Clasificador zero-shot (IA)
│   ├── model_versions.py           # Versiones fijas (commits) de los modelos de IA
│   ├── cosine_classifier.py        # Clasificador alternativo: similitud coseno
│   ├── human_review.py             # Revisión humana por consola
│   ├── categorize.py               # Orquestador: IA + revisión humana
│   ├── review_automatic.py         # Medición de precisión con revisión humana
│   ├── export_training.py          # Exporta las decisiones humanas a CSV
│   ├── restore_decisions.py        # Restaura las decisiones humanas desde el CSV
│   ├── evaluate.py                 # Banco de pruebas para comparar configuraciones
│   ├── train_classifier.py         # Experimento: clasificador entrenado (pseudo-etiquetado)
│   ├── train_setfit.py             # Fine-tuning con SetFit
│   ├── translator.py               # Traductor inglés -> español (IA)
│   ├── translate_questions.py      # Traducción masiva de las preguntas
│   ├── verify_lang.py              # Muestra preguntas en inglés y español
│   └── fix_encoding.py             # Reparación de codificación (ya integrada en load_data)
├── data/
│   ├── training_data.csv           # Decisiones humanas (ejemplos verificados)
│   └── precision_review.csv        # Registro de la revisión de precisión
├── tests/
│   ├── conftest.py                 # Marcadores por carpeta, base de prueba y cliente de la API
│   ├── unit/
│   │   ├── test_categories.py
│   │   ├── test_classifier.py
│   │   ├── test_human_review.py
│   │   ├── test_load_data.py
│   │   ├── test_model_versions.py
│   │   ├── test_statistics.py
│   │   └── test_translator.py
│   ├── integration/
│   │   ├── test_api.py
│   │   ├── test_game.py
│   │   ├── test_restore_decisions.py
│   │   └── test_translation_columns.py
│   ├── data_quality/
│   │   ├── conftest.py             # Conexión a la base real (saltea si no está disponible)
│   │   ├── test_categorizations.py
│   │   ├── test_csv_files.py
│   │   ├── test_questions.py
│   │   └── test_translations.py
│   └── validation/
│       ├── test_api_auth.py
│       ├── test_api_inputs.py
│       ├── test_api_robustness.py
│       └── test_model_quality.py
├── .vscode/settings.json           # Configura VS Code para usar Poetry
├── prueba_clasificador.py          # Prueba rápida del clasificador
├── prueba_traduccion.py            # Prueba rápida de la API en español e inglés
├── docker-compose.yml              # Servicio de PostgreSQL
├── .env.example                    # Plantilla de credenciales (copiar como .env)
├── pyproject.toml                  # Dependencias y configuración de pytest
├── poetry.lock                     # Versiones exactas de las dependencias
├── EXERCISE.md                     # Consigna del ejercicio base
├── CONCEPTS.md                     # Conceptos del ejercicio base
├── EXERCISE_AI_CATEGORIZATION.md   # Consigna de la categorización con IA
├── CONCEPTS_AI_CATEGORIZATION.md   # Conceptos de la categorización con IA
├── EXERCISE_AI_TRANSLATION.md      # Consigna de la traducción con IA
├── CONCEPTS_AI_TRANSLATION.md      # Conceptos de la traducción con IA
├── EXERCISE_AI_UIUX.md             # Consigna de la interfaz (próxima etapa)
├── CONCEPTS_AI_UIUX.md             # Conceptos de la interfaz (próxima etapa)
└── FIRST_STEPS.md                  # Instrucciones de la cátedra para traer cada consigna
```

Cada carpeta de `tests/` tiene además un `__init__.py` vacío. Las carpetas `models/` (modelos entrenados) y `checkpoints/` se generan al entrenar y no se suben al repositorio, igual que el archivo `.env` (credenciales), los entornos virtuales y la caché de Python (ver `.gitignore`).

## Base de datos

Dos tablas: las preguntas del dataset (en inglés y su traducción al español) y la categoría asignada a cada una. Cada pregunta tiene como máximo una categorización.

```mermaid
erDiagram
    QUESTIONS ||--o| CATEGORIZATIONS : tiene
    QUESTIONS {
        int id PK
        text question
        text answer "respuesta correcta"
        text wrong_1
        text wrong_2
        text wrong_3
        string category "categoría original del dataset"
        string source
        text question_es "traducción (vacía si no está traducida)"
        text answer_es
        text wrong_1_es
        text wrong_2_es
        text wrong_3_es
        bool is_translated
        string translation_model "modelo que tradujo"
    }
    CATEGORIZATIONS {
        int id PK
        int question_id FK
        string category_name "categoría asignada"
        float confidence_score "confianza de la IA, de 0 a 1"
        bool is_automatic "true si decidió la IA"
        datetime created_at
    }
```

La categoría original del dataset (`questions.category`) se conserva aparte de la asignada (`categorizations.category_name`), para poder compararlas. Del mismo modo, la traducción se guarda en columnas aparte (`_es`) y el inglés original nunca se modifica.

## Requisitos

- **Python 3.11 a 3.13**
- **[Poetry](https://python-poetry.org/)** para el manejo de dependencias
- **[Docker](https://www.docker.com/)** para la base de datos
- **Opcional:** GPU NVIDIA para acelerar la IA. Sin GPU todo funciona igual, pero la categorización completa pasa de ~35 minutos a varias horas, y la traducción, de ~45 minutos a muchas horas.
- Unos **5 GB libres** en disco para las dependencias de IA y los modelos.

## Instalación y puesta en marcha

Todos los comandos se ejecutan **desde la raíz del proyecto**. Los ejemplos son para PowerShell (Windows), pero funcionan igual en Linux y macOS.

### 1. Instalar las dependencias

```powershell
poetry install
```

### 2. Configurar y levantar la base de datos

Las credenciales de la base no están en el código: se leen de un archivo `.env`, que no se sube al repositorio. Crearlo a partir de la plantilla:

```powershell
Copy-Item .env.example .env
```

Abrir `.env` y reemplazar `cambiar_esto` por una contraseña propia. Se puede generar una segura con:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(24))"
```

Usar solo letras, números, `-` y `_` (otros caracteres como `$` o `#` pueden dar problemas en el `.env`).

En el mismo `.env`, completar `API_KEY` con otra clave generada con el mismo comando (distinta de la contraseña). Es la que pide la API para los endpoints de administración (ver [Autenticación](#autenticación)). Si queda vacía, el juego y las estadísticas funcionan igual, pero la administración queda deshabilitada.

Después, levantar la base:

```powershell
docker compose up -d
```

La base queda accesible **solo desde esta computadora** (`127.0.0.1`), no desde la red.

> [!IMPORTANT]
> La contraseña del `.env` se aplica **solo cuando la base se crea por primera vez**. Si ya existía una base de una instalación anterior (por ejemplo, con la contraseña vieja `admin123`), hay dos opciones:
> - Cambiar la contraseña de la base existente: `docker compose exec db psql -U admin -d questions_db`, escribir `\password admin`, ingresar la misma contraseña del `.env` y salir con `\q`.
> - Borrar la base y empezar de cero con `docker compose down -v` y `docker compose up -d` (hay que repetir todos los pasos siguientes).

### 3. Cargar las preguntas

```powershell
poetry run python -m app.load_data
```

Descarga el dataset de Hugging Face, repara los errores de codificación, filtra las preguntas válidas y las carga en la base. Ver [Dataset](#dataset).

> [!WARNING]
> Este script reemplaza todas las preguntas y borra sus categorizaciones y traducciones. Las decisiones humanas se recuperan con el paso siguiente; la categorización y la traducción se rehacen con los pasos 5 y 6.

### 4. Restaurar las decisiones humanas

```powershell
poetry run python -m app.restore_decisions
```

Recupera las 135 categorizaciones revisadas por una persona, guardadas en `data/training_data.csv`, para no tener que repetir esa revisión.

### 5. Categorizar el resto con IA

```powershell
poetry run python -m app.categorize --auto-only
```

Clasifica las preguntas restantes y guarda automáticamente las que superan el 70% de confianza. La primera vez descarga el modelo (~1,7 GB). Tarda ~35 minutos con GPU. Se puede cortar con `Ctrl+C` y retomar: solo procesa lo que falta.

### 6. Traducir al español

```powershell
poetry run python -m app.translate_questions --batch-size 64
```

Traduce cada pregunta y sus 4 opciones con IA y guarda la traducción junto al inglés original. La primera vez descarga el modelo (~300 MB). Tarda ~45 minutos con GPU. Igual que la categorización, se puede cortar con `Ctrl+C` y retomar. Ver [Traducción con IA](#traducción-con-ia).

Para ver el resultado: `poetry run python -m app.verify_lang` muestra algunas preguntas en inglés y en español, y cuántas están traducidas.

### 7. Levantar la API

```powershell
poetry run uvicorn app.main:app --reload
```

- API: `http://localhost:8000`
- Documentación interactiva: `http://localhost:8000/docs` (se puede ocultar con `ENABLE_DOCS=false` en el `.env`, por ejemplo si la API se publica en internet)

Para acceder desde otro dispositivo de la misma red (por ejemplo, una notebook o un celular), agregar `--host 0.0.0.0` y usar la IP local de la computadora, que se obtiene con `ipconfig`. La primera vez, el Firewall de Windows pide permiso para redes privadas.

## Uso de GPU (opcional)

En Windows, el PyTorch que instala Poetry es la versión **solo CPU**. Para usar una GPU NVIDIA:

1. Ver qué versión de CUDA soporta el driver:
   ```powershell
   nvidia-smi
   ```
   Arriba a la derecha dice `CUDA Version: XX.X`.

2. Elegir en [pytorch.org/get-started/locally](https://pytorch.org/get-started/locally/) una versión de CUDA **menor o igual** a esa, y reinstalar PyTorch. Por ejemplo, con CUDA 13.0:
   ```powershell
   poetry run pip uninstall -y torch
   poetry run pip install torch --index-url https://download.pytorch.org/whl/cu130
   ```
   Las placas de la serie RTX 50 necesitan CUDA 12.8 o superior.

3. Verificar:
   ```powershell
   poetry run python -c "import torch; print(torch.__version__, torch.cuda.is_available())"
   ```
   Tiene que mostrar una versión terminada en `+cu...` y `True`.

> [!IMPORTANT]
> Cada `poetry install` o `poetry add` vuelve a instalar la versión de CPU. Después de usarlos, verificar y repetir el paso 2 si hace falta.

El código detecta la GPU automáticamente: si está disponible la usa, y si no, usa la CPU. La versión de CUDA no se fija en `pyproject.toml` para que el proyecto se pueda instalar en cualquier computadora.

## API

| Método | Ruta | Clave | Descripción |
|---|---|:---:|---|
| GET | `/` | | Estado de la API y lista de endpoints |
| GET | `/game/question` | | Una pregunta al azar para jugar, con las opciones mezcladas y **sin revelar la correcta**. Filtros opcionales `?category=` y `?lang=es` o `en` |
| POST | `/game/answer` | | Comprueba la opción elegida y recién ahí revela la correcta (`?lang=` para el idioma de la respuesta) |
| GET | `/stats` | | Total de preguntas y cantidad por categoría original del dataset |
| GET | `/categories` | | Las 6 categorías disponibles |
| GET | `/categories/stats` | | Total, categorizadas, pendientes, automáticas, manuales y cantidad por categoría |
| GET | `/translation/stats` | | Total, traducidas, sin traducir, porcentaje y modelo de traducción usado |
| GET | `/questions` | 🔒 | Lista de preguntas con sus respuestas, en inglés y español, paginada |
| GET | `/questions/{id}` | 🔒 | Una pregunta por su id |
| GET | `/questions/category/{category_name}` | 🔒 | Preguntas categorizadas (por IA o por una persona) en esa categoría, paginadas. Incluye la categoría original del dataset, la asignada y la traducción |
| POST | `/questions` | 🔒 | Crea una pregunta nueva |
| PUT | `/categorizations/{id}` | 🔒 | Corrige la categoría de una pregunta (queda registrada como decisión humana) |

🔒 = requiere API key (ver [Autenticación](#autenticación)).

### Juego

Los endpoints del juego nunca muestran la respuesta correcta antes de que el jugador elija, así que no se puede hacer trampa mirando lo que devuelve la API (por ejemplo, con las herramientas de desarrollador del navegador). Solo usan preguntas categorizadas, y la categoría que muestran es la asignada.

**Pedir una pregunta** (`GET /game/question?category=ciencia&lang=es`; sin `category`, sale de cualquiera):

```json
{
  "id": 1,
  "question": "Tres de estos animales hibernan. ¿Cuál no?",
  "category": "ciencia",
  "options": ["Rana", "Pereza", "Serpiente", "Ratón"],
  "lang": "es"
}
```

Las opciones se mezclan en cada pedido.

**Idioma** (`?lang=`): `es` (por defecto) o `en`. Cualquier otro valor responde **422**. La misma pregunta (mismo `id`) se puede pedir en los dos idiomas. Si se pide español y la pregunta no tiene traducción (ver [Traducción con IA](#traducción-con-ia)), viene en inglés, y el campo `lang` de la respuesta lo indica.

**Responder** (`POST /game/answer?lang=es`), con el texto de la opción elegida:

```json
{ "question_id": 1, "answer": "Rana" }
```

```json
{ "correct": false, "correct_answer": "Pereza" }
```

(La respuesta correcta es *Sloth*, el perezoso: "Pereza" es uno de los [errores conocidos](#errores-conocidos) de la traducción).

Acepta la respuesta en **cualquiera de los dos idiomas** ("Pereza" o "Sloth"); `?lang=` solo define en qué idioma vuelve `correct_answer`. No distingue mayúsculas ni espacios al principio o al final. Responde **404** si la pregunta (o la categoría pedida) no existe.

### Autenticación

El juego, las categorías y las estadísticas son públicos. Los endpoints de **administración** (🔒 en la tabla) piden una clave en el encabezado `X-API-Key`, que tiene que coincidir con `API_KEY` del `.env`. Son los que modifican datos y los que muestran las respuestas correctas:

- Sin clave o con una clave incorrecta, responden **401**.
- Si el `.env` no tiene `API_KEY`, responden **503**: la administración queda deshabilitada.

**Desde la documentación interactiva** (`/docs`): botón **Authorize** arriba a la derecha, pegar la clave y confirmar. Desde ahí, los pedidos de prueba la mandan solos.

**Desde PowerShell:**

```powershell
$headers = @{ "X-API-Key" = "tu_clave" }
Invoke-RestMethod -Method Put -Uri http://localhost:8000/categorizations/1 -Headers $headers -ContentType "application/json" -Body '{"category_name": "arte"}'
```

> [!NOTE]
> Es una única clave compartida, pensada para que solo quien administra el proyecto pueda ver las respuestas y modificar datos. Si la API se publica en internet, tiene que ir detrás de HTTPS: sin cifrado, la clave viaja a la vista.

### Uso

Los nombres de categoría para las rutas son: `geografia`, `historia`, `ciencia`, `arte`, `entretenimiento` y `deportes`. No distinguen mayúsculas.

**Paginación:** `skip` (≥ 0) y `limit` (entre 1 y 100). Por ejemplo, `/questions/category/arte?skip=0&limit=5`.

**Crear una pregunta** (`POST /questions`):

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

Reglas (definidas en `app/schemas.py`):

- Todos los campos son obligatorios y de texto. Se recortan los espacios al principio y al final, y no pueden quedar vacíos.
- `question` admite hasta **1000** caracteres y cada opción hasta **300**. Los límites se eligieron midiendo el dataset: la pregunta más larga tiene 628 caracteres y la opción más larga, 255.
- Las 4 opciones tienen que ser distintas (sin distinguir mayúsculas).
- `category` tiene que ser una de las 6 categorías, como nombre (`geografia`) o etiqueta (`Geografía`). Se guarda siempre como etiqueta.
- No se aceptan campos de más. El origen (`source`) lo pone la API: siempre `manual`.

**Corregir una categorización** (`PUT /categorizations/{id}`). El `id` de la categorización aparece como `categorization_id` en `/questions/category/{category_name}`:

```json
{
  "category_name": "arte"
}
```

`category_name` acepta el nombre (`arte`) o la etiqueta (`Arte`), sin distinguir mayúsculas.

**Códigos de error:**

- **401**: falta la API key o es incorrecta (solo en los endpoints de administración).
- **503**: la administración está deshabilitada porque el `.env` no tiene `API_KEY`.
- **404**: el recurso no existe, como una pregunta, una categoría o una categorización inexistente.
- **422**: los datos enviados no cumplen las reglas: falta un campo, está vacío, es demasiado largo, no es texto, las opciones se repiten, la categoría no existe, sobra un campo, `limit=1000` o un `id` que no es un número. Lo responde FastAPI automáticamente, e indica en `detail` qué campo falló y por qué:

```json
{
  "detail": [
    {
      "loc": ["body", "answer"],
      "msg": "String should have at most 300 characters"
    }
  ]
}
```

## Dataset

### Origen

**[kth8/OpenTriviaQA](https://huggingface.co/datasets/kth8/OpenTriviaQA)**: 49.599 preguntas de trivia de opción múltiple, en inglés, en formato Parquet. Es una versión del proyecto [OpenTriviaQA](https://github.com/uberspot/OpenTriviaQA).

Reemplazó al dataset original de la consigna, que no estaba disponible (era privado) y además no tenía opciones incorrectas, necesarias para un juego de este tipo.

**Versión fija y verificada.** `load_data` no descarga "la última versión" del dataset, sino un commit fijo (`DATASET_REVISION`), y antes de cargar nada compara el hash SHA-256 del archivo con el esperado (`DATASET_SHA256`). Si no coinciden, se detiene sin tocar la base. Así todos obtienen exactamente las mismas preguntas, y un cambio en el dataset (o un archivo alterado) no pasa desapercibido.

Para actualizar el dataset a propósito, hay que cambiar esas dos constantes en `app/load_data.py`, volver a cargar y categorizar, y actualizar los resultados de este README.

### Limpieza (`app/load_data.py`)

1. **Reparación de codificación con `ftfy`**: el dataset tenía 778 preguntas con caracteres mal codificados, por ejemplo `Queenâ\x80\x99s` en lugar de `Queen's`. Algunos de esos caracteres eran códigos de control que llegaban a trabar la terminal.
2. **Solo preguntas de 4 opciones**: la correcta más exactamente 3 incorrectas distintas. Se descartan las de Verdadero/Falso.
3. **Preguntas Verdadero/Falso "disfrazadas"**: se descartan las que tienen "True" o "False" entre sus 4 opciones; las otras dos opciones resultaron ser fragmentos de texto cortados.
4. **Duplicados**: algunas preguntas aparecían en varias categorías del dataset; se conserva solo la primera aparición.
5. **Mapeo de categorías** a las 6 de Preguntados (las demás, como *celebrities* o *rated*, se descartan):

| Categoría | Categorías originales |
|---|---|
| Geografía | geography, world |
| Historia | history |
| Ciencia | science-technology, animals |
| Arte | literature, humanities |
| Entretenimiento | movies, music, television, video-games |
| Deportes | sports |

**Resultado: 26.836 preguntas válidas.** Los problemas de duplicados y de Verdadero/Falso disfrazadas los encontraron los [tests de calidad de datos](#tests).

### Una advertencia sobre las categorías originales

La categoría original del dataset **no es una referencia confiable**. La categoría *world* (mapeada a Geografía) resultó ser una mezcla con muchas preguntas de historia y política, y el dataset muchas veces clasificaba según la respuesta y no según el tema: una pregunta sobre el perro de Richard Nixon estaba en *animals* (→ Ciencia). Por eso, la "coincidencia con el dataset" se usó solo como referencia aproximada, y la precisión real se midió con [revisión humana](#precisión-real-revisión-humana).

## Categorización con IA

### Cómo funciona

```mermaid
flowchart LR
    A[Hugging Face<br/>OpenTriviaQA] -->|load_data| B[(Preguntas)]
    C[training_data.csv<br/>decisiones humanas] -->|restore_decisions| D[(Categorizaciones)]
    B --> E{IA zero-shot<br/>confianza ≥ 70%?}
    E -->|Sí| F[Automática]
    E -->|No| G[Revisión humana]
    G -->|Acepta o corrige| H[Manual]
    G -->|Saltea| I[Queda pendiente]
    F --> D
    H --> D
    D --> J[API FastAPI]
```

1. **Clasificación *zero-shot***: el modelo [`MoritzLaurer/deberta-v3-large-zeroshot-v2.0`](https://huggingface.co/MoritzLaurer/deberta-v3-large-zeroshot-v2.0) evalúa, para cada categoría, qué tan probable es la frase *"This trivia question is about {descripción de la categoría}."* dado el texto. No necesita entrenamiento previo con estas preguntas.
2. **El modelo ve la pregunta junto con su respuesta correcta**, que le da más contexto.
3. **Umbral de confianza del 70%**: si la IA supera el umbral, la categorización se guarda automáticamente; si no, se deriva a una persona.
4. **Revisión humana**: la persona ve la pregunta, la respuesta, la sugerencia de la IA y los scores de todas las categorías, y acepta la sugerencia, elige otra categoría o saltea la pregunta.

**Versiones fijas de los modelos.** Cada modelo de Hugging Face se descarga en un commit fijo, definido en `app/model_versions.py`, que es la versión con la que se midieron los resultados. Sin esto, si el autor publicara una versión nueva, los resultados podrían cambiar sin tocar el código. Un modelo que no esté en esa lista (por ejemplo, uno nuevo que se prueba con `evaluate --model`) funciona igual, con la versión más reciente y un aviso.

Las categorías y sus descripciones (en inglés, porque el modelo y las preguntas están en inglés) están en `app/categories.py`. Las descripciones de Arte y Entretenimiento se ajustaron para separar mejor la cultura "clásica" (literatura, teatro, música clásica) de la cultura popular (cine, TV, pop, videojuegos).

### Guía de categorización

Criterios que se aplicaron en la revisión humana. La regla general es **clasificar por el tema de la pregunta, no por el tipo de respuesta**: una pregunta sobre un músico es Entretenimiento aunque la respuesta sea una ciudad.

| Tema | Categoría |
|---|---|
| Símbolos, lemas, apodos, idiomas y códigos de área de países, estados o ciudades | Geografía |
| Religiones vigentes, festividades y tradiciones | Historia |
| Mitología antigua (griega, nórdica, egipcia) | Arte |
| Literatura, novelas y sus personajes | Arte |
| Compositores y obras clásicas (música clásica, ragtime, ópera), teatro clásico | Arte |
| Cantantes, bandas e intérpretes del espectáculo; musicales de Broadway | Entretenimiento |
| Cine, series, manga, anime, cómics, videojuegos | Entretenimiento |
| Científicos, matemáticos, inventos, psicología, nutrición | Ciencia |
| Ajedrez, lucha libre profesional | Deportes |
| Gastronomía, negocios no relacionados con los medios, preguntas sin contexto | Saltear |

## Traducción con IA

Sigue la consigna `EXERCISE_AI_TRANSLATION.md`, con algunas adaptaciones (detalladas abajo).

### Cómo funciona

```mermaid
flowchart LR
    A[(Preguntas<br/>en inglés)] --> B[Pregunta sola]
    A --> C["Cada opción con su pregunta<br/>(pregunta + Answer: opción)"]
    B --> D[Modelo MarianMT<br/>opus-mt-en-es]
    C --> D
    D --> E["Postprocesamiento<br/>agrega los signos ¿ y ¡<br/>y extrae la opción"]
    E --> F{¿Las 4 opciones<br/>siguen distintas?}
    F -->|Sí| G[(Se guarda en las<br/>columnas _es)]
    F -->|No| H[Queda en inglés]
```

1. **Modelo**: [`Helsinki-NLP/opus-mt-en-es`](https://huggingface.co/Helsinki-NLP/opus-mt-en-es), de la familia MarianMT (*Encoder-Decoder*, ~77 millones de parámetros), con su versión fija en `app/model_versions.py`. Genera la traducción con *beam search*.
2. **La pregunta se traduce sola**, en lotes (*batching*) para aprovechar la GPU. Los textos se ordenan por largo antes de armar los lotes: el modelo rellena todos los textos de un lote hasta el largo del más largo, así que con textos parecidos casi no hay relleno y se usa menos memoria. Si aun así un lote no entra en la memoria de la GPU, se divide en dos y se reintenta, en lugar de cortar el proceso.
3. **Cada opción se traduce junto con su pregunta**, como *"pregunta Answer: opción"*, y después se extrae lo que quedó después de *"Respuesta:"*. Así el modelo sabe de qué trata la pregunta (ver la comparación más abajo).
4. **Post-procesamiento**: agrega el `¿` o `¡` de apertura **solo si el modelo no puso ninguno**. La regla de la consigna ("si termina en `?`, agregar `¿` al principio") rompía las preguntas de varias oraciones: *"¿En el Japón antiguo... ¿Cómo?"*.
5. **Si dos opciones quedan iguales** al traducirlas, la pregunta queda en inglés: con opciones repetidas no se puede jugar. Pasa en preguntas que dependen del idioma, como *"¿Cómo se llaman las crías de tiburón?"*, donde *pups* y *cubs* se traducen las dos como "cachorros".

El inglés original nunca se modifica, así que el juego se puede ofrecer en los dos idiomas.

### Adaptaciones a la consigna

| Consigna | En este proyecto | Por qué |
|---|---|---|
| `pipeline("translation")` | `AutoTokenizer` + `AutoModelForSeq2SeqLM` + `generate()` | `transformers` 5 eliminó el pipeline de traducción. Se usa el modelo directamente, que es lo que el pipeline hacía por dentro |
| Traduce pregunta y respuesta | Pregunta y las **4 opciones**, con la pregunta como contexto | El juego muestra 4 opciones: si solo se traduce la correcta, se delata sola |
| Columnas `question_es`, `answer_es`, `is_translated`, `translation_model` | Las mismas, más `wrong_1_es`, `wrong_2_es` y `wrong_3_es` | Mismo motivo |
| `create_all()` para agregar las columnas | `ensure_translation_columns()` (en `app/models.py`) | `create_all()` solo crea tablas nuevas: **no agrega columnas** a una tabla que ya existe. La función las agrega con `ALTER TABLE` si faltan, y se llama al arrancar la API, en `load_data` y en `translate_questions` |
| `?lang` en `/questions` | `?lang` en los endpoints del juego; la administración muestra los dos idiomas | `/questions` es de administración y muestra las respuestas (ver [Autenticación](#autenticación)) |
| `"model_used"` escrito en el código | `"models_used"` leído de la base | Refleja el modelo que realmente tradujo cada pregunta |
| `test_api.py` | `prueba_traduccion.py` | pytest toma como test cualquier archivo `test_*.py`, y este necesita la API levantada |

### Cómo traducir las opciones: comparación

Las opciones son casi siempre palabras o títulos sueltos, y sin contexto el modelo se equivoca en dos sentidos opuestos: traduce nombres propios que no debería (la banda *Queen* → "Reina") y deja en inglés palabras comunes (*Sloth*). Se compararon cuatro formas de traducirlas sobre preguntas reales, incluidos los casos difíciles:

| Forma | Qué recibe el modelo | Resultado |
|---|---|---|
| A) Directa (la de la consigna) | `Sloth` | Traduce títulos y nombres: *Blondie* → "Rubia", *Batman Forever* → "Batman para siempre", *Harpers Ferry* → "Ferry Harpers" |
| B) Entre comillas | `The answer is "Sloth".` | Las comillas le indican "literal": respeta los nombres, pero deja en inglés palabras comunes (*Mouse*) |
| C) Con dos puntos | `The answer is: Sloth.` | Traduce bien las palabras comunes, pero también los títulos de discos y películas |
| **D) Con la pregunta (elegida)** | `<pregunta> Answer: Sloth` | **La mejor**: con el contexto deja sin traducir los títulos del álbum de Massive Attack (*Blue Lines*, *100th Window*) y usa los títulos oficiales en español cuando existen (*Jaws* → "Tiburón", *Star Wars: Episode IV - A New Hope* → "Star Wars: Episodio IV - Una nueva esperanza") |

Ninguna es perfecta: en la muestra, A tuvo 7 errores, B 6, C unos 4 y D 3.

### Resultado

| | |
|---|---|
| Preguntas traducidas | **26.790 de 26.836 (99,8%)** |
| Quedaron en inglés (opciones repetidas al traducir) | 46 |
| Tiempo | ~45 minutos con una RTX 5070 Ti, con lotes de 64 |

### Errores conocidos

- **Palabras ambiguas sin suficiente contexto**: *Sloth* (el animal) sale "Pereza" en lugar de "Perezoso", incluso con la pregunta como contexto.
- **Expresiones**: *"Which is the odd one?"* sale "¿Cuál es el extraño?" en lugar de "¿Cuál no corresponde?".
- **Nombres históricos**: *Bleeding Kansas* sale "Sangrando Kansas".
- **Preguntas que dependen del inglés** (rimas, letras, juegos de palabras): solo se detectan las que terminan con opciones repetidas.

Es un modelo chico, pensado para traducir oraciones y no para entender trivia. Ver [Limitaciones](#limitaciones-conocidas-y-posibles-mejoras).

## Scripts

Todos se ejecutan desde la raíz con `poetry run python -m app.<script>`. Los que usan IA descargan el modelo la primera vez.

| Script | Para qué |
|---|---|
| `load_data` | Descarga, limpia y carga el dataset |
| `restore_decisions` | Restaura las decisiones humanas desde `data/training_data.csv`. Es seguro correrlo varias veces |
| `categorize` | Categoriza con IA y revisión humana |
| `review_automatic` | Mide la precisión real revisando categorizaciones automáticas al azar |
| `export_training` | Exporta las decisiones humanas a `data/training_data.csv` |
| `evaluate` | Banco de pruebas: compara modelos y configuraciones sin escribir en la base |
| `train_classifier` | Experimento de pseudo-etiquetado (ver resultados) |
| `train_setfit` | Fine-tuning con SetFit y comparación con el zero-shot |
| `fix_encoding` | Repara la codificación en una base ya cargada (ya no hace falta: `load_data` lo hace al cargar) |
| `translate_questions` | Traduce al español las preguntas que todavía no están traducidas |
| `verify_lang` | Muestra algunas preguntas en inglés y en español, y cuántas están traducidas |

### `categorize`

```powershell
poetry run python -m app.categorize --limit 50        # 50 preguntas al azar, con revisión humana
poetry run python -m app.categorize --auto-only       # todas, sin revisión humana
```

| Opción | Descripción |
|---|---|
| `--limit N` | Procesar como máximo N preguntas pendientes, elegidas al azar |
| `--threshold X` | Umbral de confianza, entre 0 y 1 (por defecto 0.70) |
| `--batch-size N` | Preguntas que procesa la GPU en paralelo (por defecto 16) |
| `--auto-only` / `--no-review` | Guardar solo las de alta confianza y saltear las demás |

### `review_automatic`

```powershell
poetry run python -m app.review_automatic --sample 60                    # 60 al azar
poetry run python -m app.review_automatic --sample 15 --category arte    # solo de una categoría
poetry run python -m app.review_automatic --sample 0                     # solo ver el reporte
```

Cada revisión se registra en `data/precision_review.csv`. Si la persona marca una categorización como incorrecta, se corrige en la base. El reporte calcula la precisión con un intervalo de confianza del 95% (método de Wilson).

### `evaluate`

```powershell
poetry run python -m app.evaluate --with-answer
poetry run python -m app.evaluate --model facebook/bart-large-mnli --with-answer
poetry run python -m app.evaluate --method cosine --with-answer --short-labels
```

| Opción | Descripción |
|---|---|
| `--method` | `zero-shot` (por defecto) o `cosine` |
| `--model` | Modelo de Hugging Face para zero-shot |
| `--template` | Frase de hipótesis |
| `--with-answer` | Incluir la respuesta correcta en el texto |
| `--short-labels` | Usar etiquetas cortas ("geography") en lugar de las descripciones largas |
| `--sample N` / `--seed N` | Tamaño y semilla de la muestra (por defecto 2000 y 42) |

Usa siempre la misma muestra para una semilla dada, así las comparaciones son reproducibles. Muestra el acierto top-1, la cobertura y la coincidencia para varios umbrales, el detalle por categoría y la velocidad.

### `translate_questions`

```powershell
poetry run python -m app.translate_questions --limit 200       # prueba chica
poetry run python -m app.translate_questions --batch-size 64   # todas las que falten
```

| Opción | Descripción |
|---|---|
| `--limit N` | Traducir como máximo N preguntas |
| `--batch-size N` | Textos que el modelo traduce a la vez (por defecto 32). Más es más rápido, pero usa más memoria de la GPU. Si un lote no entra, se divide solo |

Cada tanda de 256 preguntas se guarda al terminarla. Si hubo que dividir lotes por falta de memoria, el resumen final lo informa; si son muchos, conviene bajar el `--batch-size`. Las preguntas que quedan en inglés por opciones repetidas se vuelven a intentar si se corre de nuevo (y dan el mismo resultado).

### `verify_lang`

```powershell
poetry run python -m app.verify_lang              # las primeras 5
poetry run python -m app.verify_lang --limit 10
```

### `prueba_traduccion.py`

```powershell
poetry run python prueba_traduccion.py
```

Con la API levantada, pide una pregunta del juego en español, muestra su respuesta correcta en español y en inglés, pide otra en inglés y muestra las estadísticas de traducción.

### `prueba_clasificador.py`

```powershell
poetry run python prueba_clasificador.py
```

Clasifica 6 preguntas de ejemplo. Sirve para comprobar rápido que el modelo se descarga bien y que la GPU funciona antes de correr procesos largos.

## Resultados

### Resultado final

| | |
|---|---|
| Preguntas | 26.836 |
| Categorizadas automáticamente por la IA | ~77% |
| Decisiones humanas | 135 (60 casos difíciles + 75 automáticas verificadas) |
| Pendientes de revisión humana | ~6.000 (~22%) |
| **Precisión de las automáticas (revisión humana)** | **100% en 60 al azar; entre 94% y 100% con 95% de confianza** |
| Traducidas al español | 26.790 (99,8%; ver [Traducción con IA](#traducción-con-ia)) |

### Evolución del sistema

Medido con `evaluate` sobre las mismas 2.000 preguntas (semilla 42). "Coincidencia" es con la categoría del dataset, sin contar Geografía (la más ruidosa).

| Configuración | Top-1 | Cobertura al 70% | Coincidencia al 70% |
|---|---:|---:|---:|
| BART, solo pregunta (inicial) | 68,5% | 26,9% | 94,8% |
| BART + respuesta | 70,0% | 20,8% | 95,6% |
| DeBERTa v2.0, solo pregunta | 77,0% | 79,5% | 92,9% |
| DeBERTa v2.0 + respuesta | 77,5% | 81,2% | 92,8% |
| **DeBERTa v2.0 + respuesta + descripciones nuevas (final)** | **77,8%** | **76,7%** | **94,0%** |

Con el mismo umbral del 70% y prácticamente la misma calidad, la automatización pasó del **27% al 77%**, y las revisiones manuales necesarias bajaron de ~19.600 a ~6.000. La configuración final se validó con otra muestra (semilla 7): top-1 de 78,2%, cobertura de 77,8% y coincidencia de 94,0%, lo que descarta que la mejora sea casualidad de una muestra (*overfitting*).

Otros hallazgos:

- **La frase de hipótesis casi no importa con DeBERTa v2.0**: tres variantes dieron el mismo top-1 (~77,5%); solo cambia la calibración de la confianza.
- **El umbral depende del modelo**: DeBERTa da scores más altos que BART, así que un mismo umbral no significa lo mismo en los dos.
- **Las descripciones nuevas** subieron el acierto en Arte de 41% a 63%, a costa de bajar Entretenimiento de 97,6% a 94,8%.

### Comparación de modelos (actividad 6)

Top-1 sobre 2.000 preguntas (semilla 42), con pregunta + respuesta, en una RTX 5070 Ti:

| Modelo | Parámetros | Descripciones largas | Etiquetas cortas | Velocidad |
|---|---:|---:|---:|---:|
| **deberta-v3-large-zeroshot-v2.0** (elegido) | 435 M | **77,9%** | **77,7%** | ~25 preguntas/s |
| bart-large-mnli | 407 M | 71,2% | 61,8% | 27 a 36 preguntas/s |
| DeBERTa-v3-base-mnli-fever-anli | 184 M | 20,2% | 67,8% | ~45 preguntas/s |
| Similitud coseno (all-mpnet-base-v2) | 110 M | 63,3% | 43,0% | **~500 preguntas/s** |

- **DeBERTa-v3-base se rompe con las descripciones largas** (20%, prácticamente azar: con 6 categorías el azar es 16,7%). Un diagnóstico mostró que elegía "Deportes" para casi cualquier pregunta. Con etiquetas cortas funciona bien y supera a BART. No es un modelo malo, sino incompatible con hipótesis largas.
- **Cada modelo responde distinto a la forma de las etiquetas**: no existe una configuración que sea la mejor para todos, y comparar modelos con una sola configuración puede llevar a conclusiones equivocadas.
- **Similitud coseno (actividad 1)**: unas 20 veces más rápida, pero bastante menos precisa. Mide qué tan parecidos son dos textos, no si uno pertenece a la categoría que describe el otro.
- Advertencia: las descripciones largas se ajustaron usando el modelo elegido, así que esa columna lo favorece un poco. En la columna de etiquetas cortas, que es neutral, igual sigue ganando.

### Precisión real (revisión humana)

La "coincidencia con el dataset" subestima a la IA, porque el dataset tiene errores. La precisión real se midió revisando a mano categorizaciones automáticas al azar (actividad 5):

| Muestra | Correctas | Intervalo de confianza 95% |
|---|---:|---|
| 60 al azar (todas las categorías) | 60/60 | 94,0% a 100% |
| 15 adicionales solo de Arte (la categoría más difícil) | 15/15 | — |

Con las 16 revisiones de Arte en total (16/16), la precisión de Arte está entre 81% y 100%. Las cifras por categoría tienen pocos casos y deben leerse con cuidado. La medición la hizo **un solo revisor**: en una evaluación formal se usan varios y se mide cuánto coinciden entre sí.

De las ~600 "diferencias" con el dataset en Historia, una muestra mostró que la mayoría eran **aciertos de la IA**: preguntas históricas que el dataset tenía en *world*.

### Fine-tuning con SetFit (actividad 2)

SetFit ajusta un modelo de `sentence-transformers` con pocos ejemplos. Se entrenó con las 135 decisiones humanas y se evaluó con validación cruzada de 5 partes, comparando con el zero-shot sobre los mismos ejemplos:

| Grupo | N | Zero-shot | SetFit |
|---|---:|---:|---:|
| **Manuales (casos difíciles)** | 60 | 68,3% | **76,7%** |
| Automáticos verificados | 75 | 100%* | 90,7% |
| Todos | 135 | 85,9% | 84,4% |

\* Por construcción: son las que el zero-shot resolvió con confianza y una persona confirmó.

SetFit mejora en los casos difíciles (+8 puntos), pero son solo 5 preguntas de diferencia sobre 60: es un resultado prometedor, no concluyente. Empeora en los casos fáciles y en Arte, por el desbalance de ejemplos (51 de Entretenimiento contra 20 de Arte). Con un 77% de acierto no alcanza para decidir solo, pero podría mejorar la sugerencia que ve la persona en la revisión humana.

### Pseudo-etiquetado (experimento sin éxito)

`train_classifier` entrena una regresión logística sobre embeddings, usando como ejemplos las ~20.800 preguntas que la IA categorizó con confianza, para clasificar las ~6.000 pendientes. Imita muy bien las decisiones de la IA (95,9%), pero en las pendientes casi no mejora al zero-shot, y su confianza no es confiable (al 90% de confianza, solo ~70% de coincidencia). Las preguntas pendientes son genuinamente difíciles (ambiguas o fuera del esquema de categorías), y aprender de los casos fáciles no enseña a resolverlas. Ese es justamente el espacio donde tiene sentido la revisión humana.

## Tests

200 tests organizados en cuatro tipos:

| Tipo | Carpeta | Qué verifica | Requisitos |
|---|---|---|---|
| Unitarios | `tests/unit/` | Funciones aisladas: categorías, limpieza de datos, descarga verificada, versiones de modelos, post-procesamiento de la traducción, revisión humana, estadística | Ninguno |
| Integración | `tests/integration/` | Varias piezas juntas: API + base de prueba, juego en dos idiomas, restauración de decisiones, columnas de traducción en una base vieja | Ninguno (usa SQLite en memoria) |
| Calidad de datos | `tests/data_quality/` | Reglas sobre los datos reales: sin campos vacíos, 4 opciones distintas, sin errores de codificación, sin duplicados, umbral respetado, CSV coherentes, traducciones completas y sin opciones repetidas | PostgreSQL con datos (si no está, esos tests se saltean) |
| Validación | `tests/validation/` | Entradas inválidas y autenticación en la API; calidad mínima del modelo de IA contra las decisiones humanas | Los del modelo cargan la IA y no corren por defecto |

```powershell
poetry run pytest -v                  # todos, salvo los lentos
poetry run pytest -m unit -v          # solo un tipo: unit, integration, data_quality o validation
poetry run pytest -m slow -v          # validación del modelo de IA (~1 minuto)
```

Cada test recibe automáticamente el marcador del nombre de su carpeta (ver `tests/conftest.py`). Los tests de la API y de restauración usan una base SQLite en memoria y un CSV temporal, así que nunca modifican los datos reales.

## Seguridad

Medidas aplicadas tras una revisión de seguridad del proyecto:

| Riesgo | Medida |
|---|---|
| Base de datos accesible desde la red | PostgreSQL escucha solo en `127.0.0.1` (ver `docker-compose.yml`) |
| Credenciales en el código | Contraseña y API key en un archivo `.env` que no se sube al repositorio (plantilla: `.env.example`) |
| Cualquiera podía modificar datos o ver las respuestas | Los endpoints de administración piden una API key (ver [Autenticación](#autenticación)) |
| Datos de entrada sin control | Validación con Pydantic: tipos, largos máximos, categorías válidas y campos permitidos (`app/schemas.py`) |
| Trampa en el juego mirando la respuesta | Endpoints de juego que revelan la correcta recién después de responder (ver [Juego](#juego)) |
| Dataset o modelos cambiados sin aviso | Versiones fijas (commits) y verificación del hash del dataset (ver [Origen](#origen)) |
| Modelo de traducción en formato antiguo (`pytorch_model.bin`, que en teoría puede ejecutar código al cargarse) | Versión fija, y PyTorch 2.6 o superior lo carga en modo restringido (`weights_only`), que solo lee los pesos |
| Librerías con vulnerabilidades conocidas | Auditoría de dependencias con `pip-audit` (abajo) y alertas automáticas de Dependabot en GitHub |
| Email personal visible en el repositorio | Commits y `pyproject.toml` con la dirección *noreply* de GitHub |
| Respuestas incorrectas o sin documentar | `404` cuando una pregunta no existe (antes respondía `200` con un error) y respuestas `401`, `404` y `503` documentadas en `/docs` |
| Documentación de la API siempre visible | Se puede ocultar con `ENABLE_DOCS=false` en el `.env` |

### Auditoría de dependencias

[`pip-audit`](https://github.com/pypa/pip-audit) compara todas las librerías instaladas con la base pública de vulnerabilidades conocidas. Se instala con `pip` dentro del entorno (no con `poetry add`, para no agregarla al proyecto ni cambiar la versión de PyTorch):

```powershell
poetry run pip install pip-audit
poetry run pip-audit
```

PyTorch instalado con CUDA (por ejemplo, `2.14.1+cu130`) no figura en PyPI y se saltea. Se puede auditar su versión equivalente de PyPI, que tiene el mismo código:

```powershell
"torch==2.14.1`ntorchvision==0.29.1" | Set-Content -Encoding ascii audit_torch.txt
poetry run pip-audit -r audit_torch.txt --no-deps
Remove-Item audit_torch.txt
```

**Última auditoría (octubre de 2026):** sin vulnerabilidades conocidas, incluidas PyTorch y torchvision.

> [!TIP]
> La auditoría es una foto del momento: pueden descubrirse vulnerabilidades nuevas en cualquier momento. Conviene repetirla antes de cada entrega o publicación. Además, el repositorio tiene activadas las **alertas de Dependabot**: GitHub revisa el `poetry.lock` y avisa si alguna dependencia pasa a tener una vulnerabilidad conocida.

## Problemas frecuentes

| Problema | Solución |
|---|---|
| `ModuleNotFoundError: No module named 'app'` | Ejecutar desde la raíz del proyecto y con `-m`: `poetry run python -m app.load_data`, no `python app/load_data.py` |
| `No module named 'app.xxx'` | El archivo no está dentro de `app/`, tiene otro nombre o no está guardado |
| PyTorch dice `+cpu` o `cuda.is_available()` da `False` | Reinstalar PyTorch con CUDA ([Uso de GPU](#uso-de-gpu-opcional)). Pasa después de cada `poetry install` o `poetry add` |
| En el intérprete de Python 3.13 no se pueden escribir llaves `{ }` con teclado en español | Usar el intérprete clásico: `$env:PYTHON_BASIC_REPL = "1"` antes de `poetry run python` |
| `poetry install` dice que no encuentra el paquete del proyecto | Ya está resuelto con `package-mode = false` en `pyproject.toml` |
| VS Code marca los imports como no resueltos | Elegir el intérprete del entorno de Poetry: `Ctrl+Shift+P` → *Python: Select Interpreter* (la ruta se obtiene con `poetry env info --path`) |
| `psql` muestra la salida en un visor y no vuelve | Salir con `q`, o agregar `-P pager=off` al comando |
| `docker compose up` dice `Falta POSTGRES_PASSWORD en el archivo .env` | Falta crear el `.env`: ver el [paso 2](#2-configurar-y-levantar-la-base-de-datos) de la instalación |
| `/docs` responde 404 | `ENABLE_DOCS` está en `false` en el `.env`: cambiarlo a `true` (o borrar la línea) y reiniciar la API |
| `/questions`, `POST` o `PUT` responden 401 | Falta el encabezado `X-API-Key` o la clave no coincide con `API_KEY` del `.env`. En `/docs`, usar el botón **Authorize** |
| `POST` o `PUT` responden 422 | Los datos no cumplen las reglas. En la respuesta, `detail` indica el campo (`loc`) y el motivo (`msg`). Ver [Uso](#uso) |
| `/questions`, `POST` o `PUT` responden 503 | Completar `API_KEY` en el `.env` y reiniciar la API |
| `password authentication failed for user "admin"` | La contraseña del `.env` no coincide con la de la base. Cambiarla en la base con `\password admin` (ver el [paso 2](#2-configurar-y-levantar-la-base-de-datos)) |
| El contenedor nuevo no arranca porque el puerto 5432 está ocupado | Quedó un contenedor viejo corriendo: bajarlo con `docker compose down` desde la carpeta donde se creó |
| La API devuelve 404 en `/questions/category/xxx` | La categoría no existe: usar `geografia`, `historia`, `ciencia`, `arte`, `entretenimiento` o `deportes` |
| `load_data` dice `El archivo descargado no coincide con la versión esperada` | El archivo del dataset cambió en Hugging Face o se corrompió en la descarga. Volver a intentar; si sigue igual, revisar si el dataset se actualizó (ver [Origen](#origen)) |
| `Aviso: ... no tiene versión fija` al cargar un modelo | El modelo no está en `app/model_versions.py`: se usa la versión más reciente. Si es un modelo que se va a usar de forma permanente, agregar su commit a esa lista |
| `KeyError: 'The task translation has been removed from transformers'` | Código escrito para `transformers` 4 (como el de la consigna). En la versión 5 hay que usar el modelo directamente, como `app/translator.py` |
| `memory allocation failed with OOM` durante `translate_questions` | La memoria de la GPU se llenó en un lote. El script lo divide en dos y reintenta solo, y al final informa cuántas veces lo hizo. Si son muchas, o se vuelve muy lento, cortarlo con `Ctrl+C` y relanzarlo con un `--batch-size` menor (por ejemplo 64): sigue desde donde quedó |
| El juego muestra preguntas en inglés aunque se pida `lang=es` | Esas preguntas no están traducidas: correr `translate_questions` (por ejemplo, después de `load_data` o de crear preguntas con `POST /questions`) |
| `column questions.question_es does not exist` | Base creada antes de la traducción. Levantar la API una vez (agrega las columnas sola) o correr `translate_questions` |
| Advertencias de *symlinks* o de `HF_TOKEN` al descargar modelos | No afectan el funcionamiento |

## Limitaciones conocidas y posibles mejoras

**Datos**

- Unas **84 preguntas dependen de contenido que se perdió** del dataset original, como un audio o una imagen ("¿en qué película escuchamos esto?"). No se descartan automáticamente porque algunas incluyen ese contenido en el texto; habría que revisarlas una por una.
- **Temas sin categoría**: gastronomía, negocios y economía no encajan en ninguna de las 6 categorías.

**Categorización**

- Agregar *mathematics*, *psychology* e *inventors* a la descripción de Ciencia: en la revisión se vieron preguntas de esos temas que la IA mandaba a Historia o Arte.
- El sistema no recuerda las preguntas salteadas en la revisión humana, que pueden volver a aparecer.
- Usar SetFit para mejorar la sugerencia de la revisión humana en los casos difíciles, confirmándolo antes con más ejemplos manuales.
- Acelerar la clasificación con media precisión (`float16`) o pasando los textos al pipeline como un `Dataset`.

**Traducción**

- Medir la calidad de la traducción con una revisión humana de una muestra, igual que la precisión de la categorización.
- Corregir los errores sistemáticos (como *Sloth* → "Pereza") con un glosario de correcciones en el post-procesamiento, como sugiere el paso 9 de la consigna.
- Probar un modelo más grande, que siga instrucciones ("traducí, pero dejá los títulos en inglés"), para las opciones que dependen del contexto.

**Evaluación**

- La precisión la midió un solo revisor; lo ideal serían varios, midiendo cuánto coinciden entre sí.

**Juego**

- La API del juego entrega preguntas sueltas al azar: todavía no evita repetir preguntas dentro de una partida ni lleva puntaje, vidas o tiempo. Esa lógica se va a definir junto con la interfaz.

**Proyecto**

- Separar las dependencias de IA en un grupo opcional de Poetry, para que la API se pueda instalar sin PyTorch.
- Si la API se publica en internet, limitar el tamaño de los pedidos en el servidor web que va delante (por ejemplo, `client_max_body_size` en nginx). Pydantic rechaza los textos demasiado largos, pero recién después de recibir el pedido completo.
- Empaquetar la API en Docker junto con una copia de la base ya categorizada, para levantar todo con `docker compose up` sin instalar Python.
- `starlette.testclient` avisa que en versiones futuras usará `httpx2` en lugar de `httpx`. Cuando el ecosistema complete la transición, habrá que migrar.

## Créditos y licencias

- **Dataset:** [kth8/OpenTriviaQA](https://huggingface.co/datasets/kth8/OpenTriviaQA), publicado bajo licencia CC BY 4.0, basado en el proyecto [OpenTriviaQA](https://github.com/uberspot/OpenTriviaQA).
- **Modelos:**
  - [MoritzLaurer/deberta-v3-large-zeroshot-v2.0](https://huggingface.co/MoritzLaurer/deberta-v3-large-zeroshot-v2.0) (licencia MIT)
  - [facebook/bart-large-mnli](https://huggingface.co/facebook/bart-large-mnli)
  - [MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli](https://huggingface.co/MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli) (licencia MIT)
  - [sentence-transformers/all-mpnet-base-v2](https://huggingface.co/sentence-transformers/all-mpnet-base-v2)
  - [Helsinki-NLP/opus-mt-en-es](https://huggingface.co/Helsinki-NLP/opus-mt-en-es) (licencia Apache 2.0)
- **Consignas:** `EXERCISE.md`, `CONCEPTS.md`, `EXERCISE_AI_CATEGORIZATION.md`, `CONCEPTS_AI_CATEGORIZATION.md`, `EXERCISE_AI_TRANSLATION.md`, `CONCEPTS_AI_TRANSLATION.md`, `EXERCISE_AI_UIUX.md` y `CONCEPTS_AI_UIUX.md`, provistas por la cátedra.
