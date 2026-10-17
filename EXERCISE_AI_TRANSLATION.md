# Instructivo: Traduciendo nuestro juego con IA

¡Hola! En este instructivo vamos a llevar a la práctica todo lo que aprendimos sobre Traducción Automática. Vamos a conectarnos a nuestra base de datos, tomar las preguntas que están en inglés, usar un modelo de Inteligencia Artificial para traducirlas al español, y guardarlas nuevamente. ¡Manos a la obra!

**Requisito previo:** Tenés que tener tu base de datos PostgreSQL corriendo con las preguntas ya cargadas (en inglés).

---

## Paso 1: Instalar dependencias de traducción

Para usar los modelos de Hugging Face necesitamos instalar algunas herramientas en nuestro proyecto. Abrí tu terminal y ejecutá el siguiente comando:

```bash
poetry add transformers sentencepiece sacremoses tqdm
```

*   `transformers`: Es la librería principal de Hugging Face que nos permite descargar y usar modelos de IA fácilmente.
*   `sentencepiece`: Es el **tokenizador** que usa el modelo Helsinki-NLP. Transforma el texto en números.
*   `sacremoses`: Es una librería que ayuda a limpiar y preparar los textos (como manejar espacios y signos de puntuación).
*   `tqdm`: Nos servirá para mostrar una barra de progreso súper amigable cuando estemos traduciendo muchas preguntas.

---

## Paso 2: Verificar el idioma actual (Script de prueba)

Vamos a crear un pequeño script para asegurarnos de que podemos conectarnos a la base y ver que las preguntas están efectivamente en inglés.

Creá un archivo llamado `app/verify_lang.py` y copiá este código:

```python
# app/verify_lang.py
from database import SessionLocal
from models import Question

def verify_questions():
    # 1. Abrimos una conexión (sesión) a la base de datos
    db = SessionLocal()
    
    try:
        # 2. Le pedimos a la base de datos las primeras 5 preguntas
        sample_questions = db.query(Question).limit(5).all()
        
        # 3. Imprimimos las preguntas para verlas
        print("--- Muestra de preguntas actuales ---")
        for q in sample_questions:
            print(f"ID: {q.id}")
            print(f"Pregunta: {q.question_text}")
            print(f"Respuesta: {q.answer_text}")
            print("-" * 30)
            
    finally:
        # 4. Siempre cerramos la conexión cuando terminamos
        db.close()

# Si ejecutamos este archivo directamente, llamamos a la función
if __name__ == "__main__":
    verify_questions()
```

Para probarlo, ejecutá en tu terminal: `python app/verify_lang.py`. Deberías ver que todo está en inglés.

---

## Paso 3: Crear el módulo de traducción

Ahora viene la magia. Vamos a crear una clase que se encargue de interactuar con el modelo de IA. 

Creá un archivo llamado `app/translator.py` y copiá el siguiente código:

```python
# app/translator.py
from transformers import pipeline

class Translator:
    def __init__(self):
        print("Cargando modelo de traducción... (esto puede tardar la primera vez porque descarga ~300MB)")
        # Inicializamos el pipeline de traducción de inglés ('en') a español ('es')
        self.model_name = "Helsinki-NLP/opus-mt-en-es"
        try:
            self.translator = pipeline("translation", model=self.model_name)
            print("¡Modelo cargado exitosamente!")
        except Exception as e:
            print(f"Error al cargar el modelo: {e}")
            self.translator = None

    def post_process_translation(self, text):
        """Limpia y corrige pequeños detalles de la traducción."""
        if not text:
            return text
            
        # Si es una pregunta (termina en '?') y no empieza con '¿', se lo agregamos
        if text.endswith('?') and not text.startswith('¿'):
            text = '¿' + text
            
        return text

    def translate(self, text):
        """Traduce un solo texto."""
        if not self.translator or not text:
            return None
            
        try:
            # El modelo nos devuelve una lista de diccionarios
            result = self.translator(text)
            translated_text = result[0]['translation_text']
            
            # Pasamos el texto por nuestro post-procesador
            return self.post_process_translation(translated_text)
        except Exception as e:
            print(f"Error traduciendo '{text}': {e}")
            return None

    def translate_batch(self, texts):
        """Traduce una lista de textos todos juntos (¡mucho más rápido!)."""
        if not self.translator or not texts:
            return []
            
        try:
            # Traducimos todo el lote
            results = self.translator(texts)
            
            # Extraemos el texto de cada resultado y aplicamos post-procesamiento
            translated_texts = []
            for res in results:
                t_text = self.post_process_translation(res['translation_text'])
                translated_texts.append(t_text)
                
            return translated_texts
        except Exception as e:
            print(f"Error en traducción por lote: {e}")
            return [None] * len(texts)

    def translate_question(self, question_text, answer_text):
        """Traduce una pregunta y su respuesta al mismo tiempo."""
        q_translated = self.translate(question_text)
        a_translated = self.translate(answer_text)
        return q_translated, a_translated
```

---

## Paso 4: Actualizar el modelo de la Base de Datos

Nuestra base de datos actual solo tiene espacio para las preguntas en inglés. Tenemos que agregarle las columnas para el español.

Abrí tu archivo `app/models.py` y modificalo para que quede EXACTAMENTE así:

```python
# app/models.py
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from database import Base

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    description = Column(String)

    questions = relationship("Question", back_populates="category")

class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    
    # Textos originales en inglés
    question_text = Column(String, unique=True, index=True)
    answer_text = Column(String)
    
    # --- NUEVAS COLUMNAS PARA TRADUCCIÓN ---
    question_es = Column(Text, nullable=True) # Pregunta en español
    answer_es = Column(Text, nullable=True)   # Respuesta en español
    is_translated = Column(Boolean, default=False) # ¿Ya la traducimos?
    translation_model = Column(String, nullable=True) # Qué IA usamos
    # ---------------------------------------

    category_id = Column(Integer, ForeignKey("categories.id"))

    category = relationship("Category", back_populates="questions")
```

---

## Paso 5: Crear el script de traducción masiva

Ahora juntamos todo. Vamos a buscar las preguntas sin traducir y las pasaremos por nuestra IA en lotes de a 32 para que sea rápido.

Creá un archivo llamado `app/translate_questions.py` y copiá este código:

```python
# app/translate_questions.py
import time
from tqdm import tqdm
from database import SessionLocal, engine
from models import Question, Base
from translator import Translator

def run_translation():
    # 1. Asegurarnos de que las nuevas columnas existan en la base de datos
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # 2. Buscar todas las preguntas que NO han sido traducidas
        untranslated = db.query(Question).filter(Question.is_translated == False).all()
        total = len(untranslated)
        
        if total == 0:
            print("¡Todas las preguntas ya están traducidas!")
            return

        print(f"Se encontraron {total} preguntas para traducir.")
        
        # 3. Inicializar nuestra IA
        ai_translator = Translator()
        if not ai_translator.translator:
            print("No se pudo iniciar el traductor. Saliendo...")
            return

        # 4. Configuración para traducir en lotes
        batch_size = 32
        start_time = time.time()
        translated_count = 0

        print(f"Empezando traducción en lotes de a {batch_size}...")
        
        # tqdm nos dibuja una barra de progreso linda
        for i in tqdm(range(0, total, batch_size)):
            # Tomamos un lote (batch) de preguntas
            batch = untranslated[i:i + batch_size]
            
            # Armamos listas con solo los textos a traducir
            q_texts = [q.question_text for q in batch]
            a_texts = [q.answer_text for q in batch]
            
            # Traducimos las listas completas (es muy rápido!)
            q_translated = ai_translator.translate_batch(q_texts)
            a_translated = ai_translator.translate_batch(a_texts)
            
            # Actualizamos cada objeto Question en la base de datos
            for j, question in enumerate(batch):
                if q_translated[j] and a_translated[j]:
                    question.question_es = q_translated[j]
                    question.answer_es = a_translated[j]
                    question.is_translated = True
                    question.translation_model = ai_translator.model_name
                    translated_count += 1
            
            # Guardamos los cambios de este lote en la base de datos
            db.commit()

        # 5. Resumen final
        end_time = time.time()
        print("\n--- Resumen de Traducción ---")
        print(f"Preguntas traducidas exitosamente: {translated_count} de {total}")
        print(f"Tiempo total: {round(end_time - start_time, 2)} segundos")
        
    except KeyboardInterrupt:
        print("\nTraducción pausada por el usuario. Se guardó el progreso actual.")
        db.commit()
    except Exception as e:
        print(f"\nOcurrió un error inesperado: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    run_translation()
```

---

## Paso 6: ¡Ejecutar la traducción!

Llegó el momento de la verdad. En tu terminal, ejecutá:

```bash
python app/translate_questions.py
```

**Salida esperada:**
Primero verás que descarga unos archivos grandes (el cerebro de la IA). Luego, te dirá cuántas preguntas encontró y verás una barra de progreso avanzando a medida que traduce en lotes.

---

## Paso 7: Actualizar la API (Endpoints)

¡Nuestra base de datos ya habla español! Pero nuestra API (FastAPI) todavía solo devuelve cosas en inglés. Tenemos que modificar `app/main.py` para que acepte un parámetro `lang` y devuelva el idioma correcto.

Abrí `app/main.py` y modificá los endpoints de preguntas para que queden así:

```python
# En app/main.py (modifica solo estas funciones)

from typing import Optional
from fastapi import FastAPI, Depends, Query, HTTPException

# ... (código existente de imports y db_dependency) ...

@app.get("/questions")
def get_questions(
    db: Session = Depends(get_db), 
    limit: int = 10,
    lang: str = Query("es", description="Idioma de las preguntas ('es' o 'en')")
):
    questions = db.query(models.Question).limit(limit).all()
    
    # Formateamos la respuesta según el idioma pedido
    results = []
    for q in questions:
        if lang == "es" and q.is_translated:
            results.append({
                "id": q.id,
                "question": q.question_es,
                "answer": q.answer_es,
                "category_id": q.category_id
            })
        else:
            # Por defecto (o si piden 'en', o si no está traducida) devolvemos inglés
            results.append({
                "id": q.id,
                "question": q.question_text,
                "answer": q.answer_text,
                "category_id": q.category_id
            })
    return results

@app.get("/questions/category/{category_name}")
def get_questions_by_category(
    category_name: str, 
    db: Session = Depends(get_db),
    lang: str = Query("es", description="Idioma de las preguntas ('es' o 'en')")
):
    category = db.query(models.Category).filter(models.Category.name == category_name).first()
    if not category:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
        
    questions = db.query(models.Question).filter(models.Question.category_id == category.id).all()
    
    results = []
    for q in questions:
        if lang == "es" and q.is_translated:
            results.append({
                "id": q.id,
                "question": q.question_es,
                "answer": q.answer_es
            })
        else:
            results.append({
                "id": q.id,
                "question": q.question_text,
                "answer": q.answer_text
            })
    return results

@app.get("/translation/stats")
def get_translation_stats(db: Session = Depends(get_db)):
    total = db.query(models.Question).count()
    translated = db.query(models.Question).filter(models.Question.is_translated == True).count()
    
    percentage = (translated / total * 100) if total > 0 else 0
    
    return {
        "total_questions": total,
        "translated_questions": translated,
        "percentage_translated": round(percentage, 2),
        "model_used": "Helsinki-NLP/opus-mt-en-es"
    }
```

---

## Paso 8: Comprobar el resultado en la API

Por último, probemos que nuestra API funciona.
1. Ejecutá la API: `uvicorn app.main:app --reload`
2. Creá un script de prueba rápida en una nueva terminal, llamalo `test_api.py`:

```python
# test_api.py
import requests

print("--- Solicitando en Español (Por defecto) ---")
response_es = requests.get("http://localhost:8000/questions?limit=2").json()
for r in response_es:
    print(f"P: {r['question']} \nR: {r['answer']}\n")

print("--- Solicitando en Inglés explícitamente ---")
response_en = requests.get("http://localhost:8000/questions?limit=2&lang=en").json()
for r in response_en:
    print(f"P: {r['question']} \nR: {r['answer']}\n")
    
print("--- Estadísticas ---")
stats = requests.get("http://localhost:8000/translation/stats").json()
print(stats)
```

Ejecutalo con `python test_api.py` y verás la diferencia.

---

## Paso 9: Manejando casos especiales (Edge cases)

En nuestra función `post_process_translation` del archivo `app/translator.py` podríamos agregar lógica más avanzada en el futuro. 
Por ejemplo, si notamos que la IA traduce el nombre "Apple" (la empresa) como "Manzana", podríamos agregar una rutina de limpieza:

```python
    def post_process_translation(self, text):
        if not text:
            return text
            
        # 1. Corrección de signos de interrogación
        if text.endswith('?') and not text.startswith('¿'):
            text = '¿' + text
            
        # 2. Evitar traducción de nombres propios (ejemplo ficticio)
        # text = text.replace("Manzana", "Apple")
            
        return text
```
¡Por ahora con arreglar los signos de interrogación es más que suficiente!

---

## Paso 10: Resumen

¡Felicitaciones! Has integrado un modelo de Inteligencia Artificial de traducción neuronal (NMT) en tu backend. 

### Archivos creados y modificados:
| Archivo | Acción | Descripción |
| :--- | :--- | :--- |
| `app/verify_lang.py` | Creado | Script para ver el idioma inicial. |
| `app/translator.py` | Creado | Clase que maneja el modelo de Hugging Face. |
| `app/models.py` | Modificado | Se agregaron columnas de español (`question_es`, etc.). |
| `app/translate_questions.py` | Creado | Script para hacer la traducción masiva (Batching). |
| `app/main.py` | Modificado | Endpoints actualizados para soportar `?lang=es`. |
| `test_api.py` | Creado | Script final para probar la API. |

Para levantar todo desde cero en el futuro, simplemente asegurate de tener PostgreSQL corriendo (por ejemplo con `docker-compose up -d` si lo tenés configurado así) y arrancá tu API con `uvicorn`. ¡Excelente trabajo!
