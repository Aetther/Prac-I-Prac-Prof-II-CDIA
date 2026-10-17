# Instructivo: Construyendo el Frontend del Juego de Trivia con React

¡Llegó el momento de crear nuestro juego de trivia visual!
Vamos a construir una SPA (Single Page Application) usando React. Esta aplicación se va a conectar a nuestra API de Python (FastAPI) para traer las preguntas que ya tenemos clasificadas.

Este instructivo te guía paso a paso. Tenés que tipear el código exactamente como se muestra, prestá atención a las llaves `{ }`, paréntesis `( )` y las mayúsculas/minúsculas.

---

## Requisito Previo
- Tu API de Python (el backend) y la base de datos deben estar funcionando y tener preguntas cargadas.
- Vas a necesitar Node.js instalado en tu computadora.

### Paso 1: Instalar Node.js
Node.js es un entorno que nos permite ejecutar JavaScript fuera del navegador, y es necesario para las herramientas de desarrollo de React.
1. Entrá a [nodejs.org](https://nodejs.org/) y descargá la versión "LTS" (Long Term Support).
2. Instalalo (es un instalador común: Siguiente, Siguiente, Siguiente).
3. Abrí una terminal (PowerShell o CMD) y verificá la instalación:
```bash
node --version
npm --version
```
(Deberías ver los números de versión instalados).

---

## Paso 2: Crear el proyecto React con Vite

**Vite** es una herramienta moderna que configura todo el proyecto React por nosotros de forma ultra rápida.

Abrí una terminal en la carpeta raíz de tu proyecto (`full-app-ai-scenario`) y ejecutá:

```bash
npm create vite@latest frontend -- --template react
```

Luego, entrá a la carpeta nueva e instalá las dependencias que descargan todas las librerías necesarias de internet:

```bash
cd frontend
npm install
```

**Estructura generada:**
Vite creó varios archivos. Los más importantes son:
- `package.json`: Lista de dependencias (librerías de terceros que usamos) y comandos para ejecutar el proyecto.
- `index.html`: El archivo principal de la web. En su interior, tiene un `<div id="root"></div>` donde React va a "inyectar" toda nuestra aplicación.
- `src/main.jsx`: El punto de entrada del código React, que agarra el `<App />` y lo pone en el `index.html`.
- `src/App.jsx`: ¡Acá es donde nosotros vamos a trabajar! Es nuestro componente principal.

---

## Paso 3: Limpiar el proyecto y armar carpetas

Vamos a borrar las cosas por defecto que trajo Vite y armar nuestra estructura de carpetas dentro de `src`.

Ejecutá los siguientes comandos (o creá/borrá las carpetas a mano):

```bash
# Estando dentro de la carpeta 'frontend'
mkdir src/components
mkdir src/services
mkdir src/styles

# Vamos a sobreescribir App.jsx y los CSS más adelante, por ahora borrá los assets
rm -rf src/assets
```

---

## Paso 4: Configurar CORS en el Backend (Python)

Por seguridad, los navegadores bloquean las peticiones desde un dominio hacia otro dominio distinto. Nuestro Frontend va a correr en `http://localhost:5173` y nuestro Backend en `http://localhost:8000`. ¡Son distintos puertos, por lo que el navegador los considera distintos orígenes!

Para arreglarlo, tenemos que decirle a nuestra API de FastAPI que permita peticiones (CORS - Cross-Origin Resource Sharing).

Editá el archivo `app/main.py` de tu backend y agregá el `CORSMiddleware`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app import models
from app.database import engine
from app.routes import router

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Trivia AI API")

# -- CONFIGURACIÓN CORS (AGREGAR ESTO) --
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # En producción se pone el dominio real, acá permitimos todos (*)
    allow_credentials=True,
    allow_methods=["*"], # Permitimos GET, POST, PUT, DELETE, etc.
    allow_headers=["*"],
)
# ---------------------------------------

app.include_router(router)
```

---

## Paso 5: El Servicio de la API (Frontend)

Vamos a crear las funciones en React para pedirle datos a nuestro Backend.
Creá el archivo `frontend/src/services/api.js` y escribí el siguiente código:

```javascript
// frontend/src/services/api.js

const API_URL = 'http://localhost:8000';

export async function fetchCategories() {
  try {
    const response = await fetch(`${API_URL}/categories/stats`);
    if (!response.ok) throw new Error('Error al cargar categorías');
    return await response.json();
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function fetchRandomQuestion(category) {
  try {
    const response = await fetch(`${API_URL}/questions/category/${category}`);
    if (!response.ok) throw new Error('Error al cargar la pregunta');
    const questions = await response.json();
    
    if (questions.length === 0) return null;
    
    // Devolvemos una al azar
    const randomIndex = Math.floor(Math.random() * questions.length);
    return questions[randomIndex];
  } catch (error) {
    console.error(error);
    return null;
  }
}
```

---

## Paso 6: Componente Lobby

El Lobby es la pantalla inicial donde los jugadores ingresan sus nombres.
Creá el archivo `frontend/src/components/Lobby.jsx`:

```javascript
// frontend/src/components/Lobby.jsx
import React, { useState } from 'react';

export default function Lobby({ onStartGame }) {
  const [player1, setPlayer1] = useState('');
  const [player2, setPlayer2] = useState('');
  const [rounds, setRounds] = useState(5);

  const handleSubmit = (e) => {
    e.preventDefault(); // Evita que recargue la página al mandar el formulario
    
    if (player1.trim() && player2.trim()) {
      onStartGame({ player1, player2, rounds: parseInt(rounds) });
    } else {
      alert('Por favor ingresen ambos nombres');
    }
  };

  return (
    <div className="lobby-container">
      <h1>Trivia IA 🤖</h1>
      <form onSubmit={handleSubmit} className="lobby-form">
        
        <div className="input-group">
          <label>Jugador 1:</label>
          <input 
            type="text" 
            value={player1}
            onChange={(e) => setPlayer1(e.target.value)}
            placeholder="Nombre..."
          />
        </div>

        <div className="input-group">
          <label>Jugador 2:</label>
          <input 
            type="text" 
            value={player2}
            onChange={(e) => setPlayer2(e.target.value)}
            placeholder="Nombre..."
          />
        </div>

        <div className="input-group">
          <label>Rondas Totales:</label>
          <select value={rounds} onChange={(e) => setRounds(e.target.value)}>
            <option value="3">3 Rondas (Rápido)</option>
            <option value="5">5 Rondas (Normal)</option>
            <option value="10">10 Rondas (Largo)</option>
          </select>
        </div>

        <button type="submit" className="start-btn">¡Comenzar Juego!</button>
      </form>
    </div>
  );
}
```

---

## Paso 7: Componente Scoreboard

Muestra quién va ganando y en qué ronda estamos.
Creá el archivo `frontend/src/components/Scoreboard.jsx`:

```javascript
// frontend/src/components/Scoreboard.jsx
import React from 'react';

export default function Scoreboard({ players, scores, currentRound, totalRounds }) {
  return (
    <div className="scoreboard">
      <div className="round-info">
        Ronda {currentRound} / {totalRounds}
      </div>
      
      <div className="scores-container">
        <div className="score-box player1">
          <span className="name">{players.player1}</span>
          <span className="points">{scores.player1} pts</span>
        </div>
        
        <div className="score-box player2">
          <span className="name">{players.player2}</span>
          <span className="points">{scores.player2} pts</span>
        </div>
      </div>
    </div>
  );
}
```

---

## Paso 8: Componente Wheel (Ruleta con Canvas)

¡Acá usamos Canvas API para dibujar una ruleta y animarla con matemáticas de geometría!
Creá el archivo `frontend/src/components/Wheel.jsx`:

```javascript
// frontend/src/components/Wheel.jsx
import React, { useRef, useEffect, useState } from 'react';

const CATEGORY_COLORS = {
  "Ciencia": "#3498db",
  "Historia": "#f1c40f",
  "Deportes": "#e67e22",
  "Entretenimiento": "#9b59b6",
  "Arte": "#e74c3c",
  "Geografía": "#2ecc71",
  "General": "#34495e"
};

export default function Wheel({ categories, onSpinComplete }) {
  const canvasRef = useRef(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentRotation, setCurrentRotation] = useState(0);

  // Dibuja la ruleta
  useEffect(() => {
    if (!categories || categories.length === 0) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const radius = width / 2;
    const centerX = width / 2;
    const centerY = height / 2;

    const sliceAngle = (2 * Math.PI) / categories.length;

    // Limpiar canvas
    ctx.clearRect(0, 0, width, height);

    // Dibujar sectores
    categories.forEach((cat, index) => {
      const startAngle = index * sliceAngle + currentRotation;
      const endAngle = startAngle + sliceAngle;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();

      ctx.fillStyle = CATEGORY_COLORS[cat] || "#95a5a6";
      ctx.fill();
      ctx.stroke();

      // Dibujar texto
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(startAngle + sliceAngle / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "#fff";
      ctx.font = "bold 16px Arial";
      ctx.fillText(cat, radius - 10, 5);
      ctx.restore();
    });

    // Dibujar el marcador superior (el "pincho" rojo)
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX - 10, -20);
    ctx.lineTo(centerX + 10, -20);
    ctx.fillStyle = "red";
    ctx.fill();
    ctx.closePath();

  }, [categories, currentRotation]);

  const spinWheel = () => {
    if (isSpinning || !categories || categories.length === 0) return;
    
    setIsSpinning(true);
    
    // Animación matemática
    const spinDuration = 3000; // 3 segundos
    const startTime = performance.now();
    
    // Cantidad de vueltas locas que da antes de frenar
    const totalRotation = currentRotation + (Math.PI * 2 * 5) + Math.random() * Math.PI * 2;

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / spinDuration, 1);
      
      // Función de aceleración inversa (ease-out cubic)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      const newRotation = currentRotation + (totalRotation - currentRotation) * easeOut;
      setCurrentRotation(newRotation);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsSpinning(false);
        // Calcular en qué categoría cayó
        // Invertimos la rotación para saber qué ángulo quedó arriba (en -90 grados, o 270 grados = Math.PI * 1.5)
        const normalizedRotation = newRotation % (2 * Math.PI);
        // El puntero está en la parte superior del canvas, correspondiente al ángulo 3*PI/2 en nuestro dibujo
        let selectedAngle = (Math.PI * 1.5 - normalizedRotation) % (2 * Math.PI);
        if (selectedAngle < 0) selectedAngle += 2 * Math.PI;

        const sliceAngle = (2 * Math.PI) / categories.length;
        const selectedIndex = Math.floor(selectedAngle / sliceAngle);
        
        onSpinComplete(categories[selectedIndex]);
      }
    };

    requestAnimationFrame(animate);
  };

  return (
    <div className="wheel-container">
      <h2>¡Girá la ruleta!</h2>
      <div style={{ position: 'relative' }}>
        <canvas ref={canvasRef} width="300" height="300" className="wheel-canvas" />
      </div>
      <button 
        onClick={spinWheel} 
        disabled={isSpinning || !categories || categories.length === 0}
        className="spin-btn"
      >
        {isSpinning ? "Girando..." : "GIRAR"}
      </button>
    </div>
  );
}
```

---

## Paso 9: Componente Timer

La barra de tiempo que pone nerviosos a los jugadores.
Creá el archivo `frontend/src/components/Timer.jsx`:

```javascript
// frontend/src/components/Timer.jsx
import React, { useState, useEffect } from 'react';

export default function Timer({ duration, onTimeUp }) {
  const [timeLeft, setTimeLeft] = useState(duration);

  useEffect(() => {
    // Si llega a 0, avisamos al componente padre
    if (timeLeft <= 0) {
      onTimeUp();
      return;
    }

    // Descontamos 1 cada segundo
    const timerId = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    // Limpieza al desmontar el componente
    return () => clearInterval(timerId);
  }, [timeLeft, onTimeUp]);

  const percentage = (timeLeft / duration) * 100;
  
  // Si quedan menos de 5 segundos, se pone rojo!
  const isDanger = timeLeft <= 5;

  return (
    <div className="timer-container">
      <div className="timer-text">Tiempo: {timeLeft}s</div>
      <div className="timer-bar-bg">
        <div 
          className="timer-bar-fill" 
          style={{ 
            width: `${percentage}%`,
            backgroundColor: isDanger ? '#e74c3c' : '#2ecc71'
          }} 
        ></div>
      </div>
    </div>
  );
}
```

---

## Paso 10: Componente QuestionCard

Muestra la pregunta y la caja de texto para responder.
Creá el archivo `frontend/src/components/QuestionCard.jsx`:

```javascript
// frontend/src/components/QuestionCard.jsx
import React, { useState } from 'react';
import Timer from './Timer';

export default function QuestionCard({ questionData, category, onAnswer }) {
  const [userAnswer, setUserAnswer] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!userAnswer.trim()) return;
    onAnswer(userAnswer);
  };

  const handleTimeUp = () => {
    // Si se acaba el tiempo, mandamos cadena vacía = incorrecto
    onAnswer("");
  };

  return (
    <div className="question-card">
      <div className="category-badge">{category}</div>
      
      <Timer duration={20} onTimeUp={handleTimeUp} />
      
      <h3 className="question-text">{questionData.question}</h3>
      
      <form onSubmit={handleSubmit} className="answer-form">
        <input
          type="text"
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          placeholder="Escribí tu respuesta..."
          autoFocus // Pone el cursor directo en el campo
          autoComplete="off"
        />
        <button type="submit" className="submit-btn">Responder</button>
      </form>
    </div>
  );
}
```

---

## Paso 11: Componente Result

Aparece de forma inmediata tras contestar, indicando si acertó o falló.
Creá el archivo `frontend/src/components/Result.jsx`:

```javascript
// frontend/src/components/Result.jsx
import React from 'react';

export default function Result({ isCorrect, correctAnswer, onNext }) {
  return (
    <div className={`result-screen ${isCorrect ? 'correct' : 'incorrect'}`}>
      <h2>{isCorrect ? "¡CORRECTO!" : "¡INCORRECTO!"}</h2>
      
      {!isCorrect && (
        <div className="correction">
          <p>La respuesta correcta era:</p>
          <p className="right-answer">{correctAnswer}</p>
        </div>
      )}
      
      <p className="points-earned">
        {isCorrect ? "+10 Puntos" : "0 Puntos"}
      </p>

      <button onClick={onNext} className="next-btn">Continuar</button>
    </div>
  );
}
```

---

## Paso 12: Componente SwitchTurn

¡Pasale el celular al otro jugador!
Creá el archivo `frontend/src/components/SwitchTurn.jsx`:

```javascript
// frontend/src/components/SwitchTurn.jsx
import React from 'react';

export default function SwitchTurn({ nextPlayerName, onReady }) {
  return (
    <div className="switch-turn-screen">
      <h2>¡Cambio de Turno!</h2>
      <p>Pasale el dispositivo a:</p>
      <h1 className="next-player-name">{nextPlayerName}</h1>
      <button onClick={onReady} className="ready-btn">¡Estoy listo!</button>
    </div>
  );
}
```

---

## Paso 13: Componente GameOver

La pantalla final para ver los resultados.
Creá el archivo `frontend/src/components/GameOver.jsx`:

```javascript
// frontend/src/components/GameOver.jsx
import React from 'react';

export default function GameOver({ players, scores, onRestart }) {
  let winnerText = "";
  if (scores.player1 > scores.player2) {
    winnerText = `¡Gana ${players.player1}! 🏆`;
  } else if (scores.player2 > scores.player1) {
    winnerText = `¡Gana ${players.player2}! 🏆`;
  } else {
    winnerText = "¡Es un Empate! 🤝";
  }

  return (
    <div className="game-over-screen">
      <h1>¡Juego Terminado!</h1>
      <h2 className="winner-text">{winnerText}</h2>
      
      <div className="final-scores">
        <div className="score-box">
          <h3>{players.player1}</h3>
          <p>{scores.player1} pts</p>
        </div>
        <div className="score-box">
          <h3>{players.player2}</h3>
          <p>{scores.player2} pts</p>
        </div>
      </div>

      <button onClick={onRestart} className="restart-btn">Jugar de Nuevo</button>
    </div>
  );
}
```

---

## Paso 14: App.jsx - El Componente Principal (State Machine)

Acá es donde juntamos todo. Unimos las pantallas controladas por estado.
Modificá `frontend/src/App.jsx` para que quede así:

```javascript
// frontend/src/App.jsx
import React, { useState, useEffect } from 'react';
import Lobby from './components/Lobby';
import Scoreboard from './components/Scoreboard';
import Wheel from './components/Wheel';
import QuestionCard from './components/QuestionCard';
import Result from './components/Result';
import SwitchTurn from './components/SwitchTurn';
import GameOver from './components/GameOver';
import { fetchCategories, fetchRandomQuestion } from './services/api';
import './styles/App.css';

// Usamos cadenas de texto para definir en qué "pantalla" estamos
const SCREENS = {
  LOBBY: 'LOBBY',
  WHEEL: 'WHEEL',
  QUESTION: 'QUESTION',
  RESULT: 'RESULT',
  SWITCH_TURN: 'SWITCH_TURN',
  GAME_OVER: 'GAME_OVER'
};

function App() {
  // --- ESTADOS DEL JUEGO ---
  const [currentScreen, setCurrentScreen] = useState(SCREENS.LOBBY);
  
  const [players, setPlayers] = useState({ player1: '', player2: '' });
  const [scores, setScores] = useState({ player1: 0, player2: 0 });
  
  const [settings, setSettings] = useState({ totalRounds: 5 });
  const [currentRound, setCurrentRound] = useState(1);
  const [currentPlayer, setCurrentPlayer] = useState('player1'); // 'player1' o 'player2'
  
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState(false);

  // Cargar categorías al inicio
  useEffect(() => {
    async function loadCategories() {
      const data = await fetchCategories();
      // data trae algo como [{category: "Historia", count: 10}, ...]
      setCategories(data.map(item => item.category));
    }
    loadCategories();
  }, []);

  // --- MANEJADORES DE EVENTOS (LOGICA DEL JUEGO) ---

  const handleStartGame = (config) => {
    setPlayers({ player1: config.player1, player2: config.player2 });
    setSettings({ totalRounds: config.rounds });
    setScores({ player1: 0, player2: 0 });
    setCurrentRound(1);
    setCurrentPlayer('player1');
    setCurrentScreen(SCREENS.WHEEL);
  };

  const handleSpinComplete = async (category) => {
    setSelectedCategory(category);
    
    // Buscar pregunta de esa categoría al backend
    const question = await fetchRandomQuestion(category);
    setCurrentQuestion(question);
    
    setCurrentScreen(SCREENS.QUESTION);
  };

  const handleAnswer = (answer) => {
    let isCorrect = false;
    
    if (currentQuestion) {
      // Normalizamos las strings a minúsculas y sin espacios al inicio/fin para comparar
      const userAns = answer.toLowerCase().trim();
      const trueAns = currentQuestion.answer.toLowerCase().trim();
      
      if (userAns === trueAns) {
        isCorrect = true;
        setScores(prev => ({
          ...prev,
          [currentPlayer]: prev[currentPlayer] + 10
        }));
      }
    }

    setLastAnswerCorrect(isCorrect);
    setCurrentScreen(SCREENS.RESULT);
  };

  const handleNextAfterResult = () => {
    // Lógica para cambiar de turno o terminar la ronda
    if (currentPlayer === 'player1') {
      setCurrentPlayer('player2');
      setCurrentScreen(SCREENS.SWITCH_TURN);
    } else {
      // Terminó de jugar player2, avanzamos de ronda
      if (currentRound >= settings.totalRounds) {
        setCurrentScreen(SCREENS.GAME_OVER);
      } else {
        setCurrentRound(prev => prev + 1);
        setCurrentPlayer('player1');
        setCurrentScreen(SCREENS.SWITCH_TURN);
      }
    }
  };

  // --- RENDERIZADO CONDICIONAL ---

  return (
    <div className="app-container">
      
      {currentScreen === SCREENS.LOBBY && (
        <Lobby onStartGame={handleStartGame} />
      )}

      {(currentScreen === SCREENS.WHEEL || currentScreen === SCREENS.QUESTION) && (
        <>
          <Scoreboard 
            players={players} 
            scores={scores} 
            currentRound={currentRound} 
            totalRounds={settings.totalRounds} 
          />
          <div className="turn-indicator">
            Turno de: <strong>{players[currentPlayer]}</strong>
          </div>
        </>
      )}

      {currentScreen === SCREENS.WHEEL && (
        <Wheel categories={categories} onSpinComplete={handleSpinComplete} />
      )}

      {currentScreen === SCREENS.QUESTION && currentQuestion && (
        <QuestionCard 
          category={selectedCategory} 
          questionData={currentQuestion} 
          onAnswer={handleAnswer} 
        />
      )}

      {currentScreen === SCREENS.RESULT && (
        <Result 
          isCorrect={lastAnswerCorrect} 
          correctAnswer={currentQuestion?.answer} 
          onNext={handleNextAfterResult} 
        />
      )}

      {currentScreen === SCREENS.SWITCH_TURN && (
        <SwitchTurn 
          nextPlayerName={players[currentPlayer]} 
          onReady={() => setCurrentScreen(SCREENS.WHEEL)} 
        />
      )}

      {currentScreen === SCREENS.GAME_OVER && (
        <GameOver 
          players={players} 
          scores={scores} 
          onRestart={() => setCurrentScreen(SCREENS.LOBBY)} 
        />
      )}

    </div>
  );
}

export default App;
```

---

## Paso 15: Agregando Estilos (CSS)

Creá el archivo `frontend/src/styles/App.css` y copiá todo esto (reemplazá el index.css generado por Vite, y asegurate de borrar `App.css` viejo si existía en `src/`).

En `src/main.jsx`, asegurate de borrar el import a `index.css` (o dejarlo vacío) para que no rompa. Todos los estilos están acá:

```css
/* frontend/src/styles/App.css */

:root {
  --bg-dark: #1a1a2e;
  --bg-panel: #16213e;
  --primary: #0f3460;
  --accent: #e94560;
  --text: #ffffff;
  --success: #2ecc71;
  --danger: #e74c3c;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

body {
  background-color: var(--bg-dark);
  color: var(--text);
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
}

.app-container {
  width: 100%;
  max-width: 500px;
  background-color: var(--bg-panel);
  min-height: 100vh;
  padding: 20px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 0 20px rgba(0,0,0,0.5);
}

@media (min-width: 550px) {
  .app-container {
    min-height: 80vh;
    border-radius: 20px;
    margin: 20px;
  }
}

/* GENERAL BOTONES E INPUTS */
input, select {
  width: 100%;
  padding: 12px;
  margin-top: 5px;
  border-radius: 8px;
  border: 1px solid var(--primary);
  background: #fff;
  color: #333;
  font-size: 16px;
}

button {
  width: 100%;
  padding: 15px;
  border: none;
  border-radius: 8px;
  background-color: var(--accent);
  color: white;
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
  margin-top: 20px;
  transition: transform 0.1s, opacity 0.2s;
  min-height: 50px; /* Tamaño táctil Mobile First */
}

button:active {
  transform: scale(0.98);
}
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* LOBBY */
.lobby-container h1 {
  text-align: center;
  margin-bottom: 30px;
  color: var(--accent);
}
.input-group {
  margin-bottom: 20px;
}

/* SCOREBOARD */
.scoreboard {
  background: rgba(0,0,0,0.2);
  border-radius: 10px;
  padding: 15px;
  margin-bottom: 15px;
}
.round-info {
  text-align: center;
  font-weight: bold;
  margin-bottom: 10px;
  color: #aaa;
}
.scores-container {
  display: flex;
  justify-content: space-between;
}
.score-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 45%;
  padding: 10px;
  border-radius: 8px;
}
.score-box.player1 { background: rgba(52, 152, 219, 0.3); border: 1px solid #3498db; }
.score-box.player2 { background: rgba(155, 89, 182, 0.3); border: 1px solid #9b59b6; }
.points { font-size: 20px; font-weight: bold; }
.turn-indicator {
  text-align: center;
  font-size: 18px;
  margin-bottom: 20px;
  padding: 10px;
  background-color: var(--primary);
  border-radius: 8px;
}

/* WHEEL */
.wheel-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-grow: 1;
  justify-content: center;
}
.wheel-container h2 { margin-bottom: 20px; }

/* TIMER */
.timer-container {
  margin: 15px 0;
}
.timer-text { margin-bottom: 5px; font-weight: bold; }
.timer-bar-bg {
  width: 100%;
  height: 10px;
  background-color: #333;
  border-radius: 5px;
  overflow: hidden;
}
.timer-bar-fill {
  height: 100%;
  transition: width 1s linear; /* Animación suave */
}

/* QUESTION CARD */
.question-card {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
}
.category-badge {
  align-self: center;
  background: var(--accent);
  padding: 5px 15px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: bold;
}
.question-text {
  font-size: 22px;
  margin: 20px 0;
  text-align: center;
}
.answer-form {
  margin-top: auto;
}

/* SCREENS COMPARTIDAS (Result, Switch, GameOver) */
.result-screen, .switch-turn-screen, .game-over-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-grow: 1;
  text-align: center;
}
.result-screen.correct { background: rgba(46, 204, 113, 0.2); border-radius: 15px; padding: 20px; }
.result-screen.incorrect { background: rgba(231, 76, 60, 0.2); border-radius: 15px; padding: 20px; }
.right-answer {
  font-size: 24px;
  font-weight: bold;
  color: var(--accent);
  margin-top: 10px;
}
.points-earned {
  font-size: 20px;
  margin: 20px 0;
  font-weight: bold;
}
.next-player-name {
  color: var(--accent);
  font-size: 36px;
  margin: 20px 0;
}
.winner-text {
  color: var(--success);
  font-size: 30px;
  margin: 20px 0;
}
.final-scores {
  display: flex;
  gap: 20px;
  width: 100%;
  margin-bottom: 20px;
}
.final-scores .score-box {
  width: 50%;
  background: rgba(255,255,255,0.1);
  border: none;
}
```

---

## Paso 16: Dockerizar TODO nuestro stack

Vamos a hacer que toda la app arranque con un solo comando usando Docker Compose.

1. Creá el archivo `frontend/Dockerfile`:

```dockerfile
# frontend/Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
# Vite por defecto usa 5173, pero le pedimos que use 3000 y se exponga a la red local (0.0.0.0)
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
```

2. Modificá el `docker-compose.yml` en la raíz de tu proyecto para agregar todos los servicios:

```yaml
version: '3.8'

services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: admin123
      POSTGRES_DB: questions_db
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  api:
    build: 
      context: .
      dockerfile: Dockerfile
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    ports:
      - "8000:8000"
    depends_on:
      - db
    volumes:
      - .:/app

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    depends_on:
      - api
    volumes:
      - ./frontend:/app
      - /app/node_modules

volumes:
  pgdata:
```

---

## Paso 17: ¡A jugar!

Asegurate de frenar si tenías algo corriendo y ejecutá:

```bash
docker compose up -d
```

Esperá un minuto a que se construyan las imágenes e instalen las cosas, y abrí en tu navegador:
👉 `http://localhost:3000`

Deberías ver la pantalla del Lobby. Ingresá dos nombres, apretá en comenzar, y preparate para girar la ruleta de Canvas.

---

## Paso 18: Probando en "Modo Celular" (Responsive)

Como usamos la estrategia de "Mobile First", tenemos que asegurarnos que se vea perfecto en celular.
1. En Chrome, apretá `F12` para abrir las herramientas de desarrollador.
2. Apretá el botón que parece un celular arriba a la izquierda (o Ctrl+Shift+M).
3. Seleccioná "iPhone 12 Pro" o un dispositivo similar arriba de todo.
4. Recargá la página (F5) y jugá una partida entera para verificar que todo se pueda leer bien y tocar fácilmente con el dedo.
