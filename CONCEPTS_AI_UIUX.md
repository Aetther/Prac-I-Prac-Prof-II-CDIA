# Conceptos: Interfaz de Usuario, Experiencia de Usuario y React

Bienvenido a la sección donde le damos "cara" a nuestra aplicación. Hasta ahora, nuestro juego de trivia vive en la terminal o a través de herramientas para desarrolladores como Swagger. Ahora, vamos a construir una interfaz real que cualquier persona pueda usar desde su navegador.

---

## 1. ¿Qué es UI y UX?

**UI (User Interface - Interfaz de Usuario):**
Es todo lo visual con lo que el usuario interactúa. Botones, colores, tipografías, menús, animaciones. Es la "fachada".

**UX (User Experience - Experiencia de Usuario):**
Es cómo se *siente* usar la aplicación. ¿Es intuitiva? ¿Es rápida? ¿El usuario entiende fácilmente qué botón tocar para jugar?

> **Analogía del Restaurante:**
> Imaginate que vas a un restaurante. La **UI** es la decoración, cómo está impresa la carta, el diseño de las mesas y los platos. La **UX** es qué tan fácil fue encontrar tu mesa, si el mozo tardó mucho en atenderte, si la comida llegó caliente y si disfrutaste toda la experiencia desde que entraste hasta que pagaste.

---

## 2. Frontend y Backend

En el desarrollo web moderno, separamos nuestras aplicaciones en dos grandes partes:

*   **Frontend (La Sala del Restaurante):** Es lo que corre en el navegador del usuario (Chrome, Safari, etc.). Es la parte visible y con la que se interactúa directamente. Está hecho con HTML, CSS y JavaScript.
*   **Backend (La Cocina del Restaurante):** Es lo que corre en el servidor. Procesa la lógica compleja, se conecta a la base de datos y provee información al Frontend mediante una API. En nuestro caso, está hecho con Python (FastAPI).

El Frontend le hace "pedidos" (requests) al Backend mediante llamadas a la API, igual que el mozo le lleva tu orden de comida a la cocina.

---

## 3. SPA (Single Page Application)

Históricamente, cada vez que hacías clic en un link en una página web, el navegador recargaba la página completa (la pantalla parpadeaba en blanco).

Una **SPA (Aplicación de Página Única)** carga el esqueleto de la página una sola vez. Cuando navegás o hacés acciones, el código JavaScript en segundo plano le pide solo los datos nuevos al servidor y actualiza solo las partes necesarias de la pantalla, sin recargarla.

Para un juego, esto es fundamental: queremos una experiencia fluida e ininterrumpida.

---

## 4. ¿Qué es React?

**React** es una librería de JavaScript creada por Facebook/Meta. Sirve para construir interfaces de usuario de forma eficiente, especialmente SPAs.

En vez de escribir HTML estático, con React escribimos código que *genera* HTML basándose en datos que pueden cambiar en tiempo real. Para eso usamos **JSX** (JavaScript XML), que nos permite escribir algo que parece HTML directamente dentro de nuestro código JavaScript.

¿Por qué no usamos HTML común? Porque para hacer un juego interactivo donde los puntos cambian, el tiempo corre y las preguntas aparecen y desaparecen, hacer todo eso "a mano" modificando el HTML con JavaScript puro (Vanilla JS) es muy difícil y propenso a errores. React nos simplifica esto enormemente.

---

## 5. Componentes: Bloques de LEGO

El concepto más importante de React son los **Componentes**.
Un componente es un pedazo de interfaz reutilizable, independiente y autocontenido. Imaginalo como un bloque de LEGO. Juntando varios componentes pequeños, armamos una aplicación gigante.

En nuestro juego de trivia, este será nuestro "Árbol de Componentes":

```text
App (Componente Principal que maneja el juego entero)
├── Lobby (Pantalla para ingresar nombres de jugadores)
├── GameBoard (Pantalla principal de juego)
│   ├── Scoreboard (Puntajes actuales)
│   ├── Wheel (La ruleta visual para girar)
│   ├── Timer (El reloj en cuenta regresiva)
│   └── QuestionCard (La tarjeta con la pregunta)
├── SwitchTurn (Pantalla para pasarle el celular al otro jugador)
└── GameOver (Pantalla de fin del juego con resultados)
```

---

## 6. Props y Estado (State)

¿Cómo manejan datos los componentes?

**Props (Propiedades):**
Son parámetros que un componente padre le pasa a un componente hijo. Son de "solo lectura". El hijo no puede modificarlos.
*Ejemplo:* El `GameBoard` le pasa a `Scoreboard` los nombres de los jugadores.

**Estado (State):**
Son los datos internos de un componente que **pueden cambiar con el tiempo**. Cuando el estado cambia, React automáticamente vuelve a dibujar (re-renderiza) el componente para mostrar la información actualizada.
Para usar estado en React, usamos el "Hook" llamado `useState`.

```jsx
// Ejemplo simple de un contador
import { useState } from 'react';

function Contador() {
  // declaramos un estado llamado 'puntos', que arranca en 0.
  // 'setPuntos' es la función para actualizar ese valor.
  const [puntos, setPuntos] = useState(0);

  return (
    <div>
      <p>Puntos actuales: {puntos}</p>
      {/* Al hacer clic, sumamos 10 puntos */}
      <button onClick={() => setPuntos(puntos + 10)}>Ganar Puntos</button>
    </div>
  );
}
```

---

## 7. Efectos (useEffect)

A veces nuestro componente necesita hacer cosas que "escapan" al simple hecho de dibujar HTML. Por ejemplo: conectarse a la API para cargar preguntas, o arrancar un reloj cuando aparece la pantalla.
Para esto usamos el Hook `useEffect`.

```jsx
import { useEffect, useState } from 'react';

function Reloj() {
  const [segundos, setSegundos] = useState(10);

  useEffect(() => {
    // Esto se ejecuta cuando el componente aparece en pantalla
    const timer = setInterval(() => {
      setSegundos((prev) => prev - 1);
    }, 1000);

    // Esto se ejecuta cuando el componente desaparece (cleanup)
    return () => clearInterval(timer);
  }, []); // <-- El "arreglo de dependencias" vacío [] significa "ejecutar solo 1 vez al inicio"

  return <p>Faltan {segundos} segundos</p>;
}
```

---

## 8. Renderizado Condicional

En nuestro juego, no queremos mostrar el Lobby y el GameOver al mismo tiempo. Necesitamos elegir qué mostrar basado en nuestro Estado. Usamos estructuras de control de JavaScript como el operador `&&` o un `switch` para esto.

```jsx
function PantallaDeJuego({ juegoIniciado }) {
  return (
    <div>
      {/* Si juegoIniciado es falso, mostramos un botón */}
      {!juegoIniciado && <button>Comenzar</button>}
      
      {/* Si juegoIniciado es verdadero, mostramos el tablero */}
      {juegoIniciado && <GameBoard />}
    </div>
  );
}
```

---

## 9. Responsive Design

Nuestra app tiene que verse bien tanto en la computadora como en el celular. Para eso usamos "Diseño Responsivo".

*   **Mobile First:** Siempre pensamos y diseñamos primero para pantallas chicas (celulares) y luego vamos "agrandando" la pantalla y agregando detalles para pantallas más grandes.
*   **Media Queries:** Es código en CSS que nos permite aplicar estilos solo si la pantalla tiene cierto tamaño.
*   **Tamaño de botones:** En un celular interactuamos con el dedo, no con un mouse con precisión de píxel. Por eso, en UX, los botones deben tener un tamaño mínimo (generalmente 44px o 48px de alto/ancho) para que sean fáciles de tocar sin equivocarse.

---

## 10. API de Canvas

Para dibujar la ruleta, no nos sirve el HTML normal. Necesitamos hacer gráficos y animaciones 2D. Para eso existe la etiqueta `<canvas>` de HTML, que es literalmente un "lienzo" en blanco.

Mediante JavaScript, podemos acceder a ese lienzo y darle comandos para dibujar: "dibujá un círculo, cortalo en porciones, rellená de colores, escribí texto, rotá todo 90 grados".
En React, para acceder al `<canvas>` directamente (ya que React suele manejar el HTML por nosotros), usamos otro Hook llamado `useRef`, que nos da una referencia directa al elemento.

---

## 11. Estilos en React

Hay muchas formas de dar estilo (poner colores, tamaños, márgenes). Nosotros usaremos:
*   Archivos `.css` tradicionales importados en nuestros componentes.
*   En JSX, la propiedad `class` de HTML se escribe `className` (porque la palabra class ya está reservada en JavaScript).
*   Estilos en línea (inline styles) para cosas dinámicas (ej: hacer una barra de progreso que cambie su ancho `style={{ width: porcentaje + "%" }}`).
*   **Variables CSS:** Para definir nuestros colores de tema una sola vez y reusarlos.

---

## 12. Docker Compose para el stack completo

Hasta ahora teníamos un `docker-compose.yml` para correr la base de datos PostgreSQL.
Ahora que tenemos un Backend (Python) y un Frontend (React), vamos a ponerlos a los tres juntos en Docker.

Con un solo comando (`docker compose up -d`), Docker va a:
1. Prender la base de datos.
2. Prender la API de Python, conectándola a la base de datos.
3. Prender el servidor web de desarrollo para React, para que podamos ver el juego en el navegador.

---

## 13. Flujo General del Sistema

Así funciona nuestra aplicación de principio a fin cada vez que querés traer una pregunta:

```text
 1. USUARIO (Hace clic en "Girar Ruleta")
       │
 2. NAVEGADOR (Ejecuta el código React del Frontend)
       │
       ▼ (React llama a fetch())
 3. PETICIÓN HTTP GET (Va por la red, hacia http://localhost:8000/questions/...)
       │
       ▼
 4. BACKEND FASTAPI (Recibe la petición HTTP, ejecuta la función de Python)
       │
       ▼ (Python usa SQLAlchemy)
 5. BASE DE DATOS POSTGRESQL (Busca la pregunta en las tablas)
       │
       ▼ (Devuelve los datos a Python)
 6. BACKEND FASTAPI (Transforma los datos a formato JSON y los devuelve)
       │
       ▼ (Respuesta HTTP 200 OK con el JSON)
 7. NAVEGADOR / REACT (Recibe los datos en la promesa del fetch())
       │
       ▼
 8. ACTUALIZACIÓN DE ESTADO (React hace setPregunta(datos))
       │
       ▼
 9. RE-RENDERIZADO (React actualiza el HTML de la pantalla)
       │
10. USUARIO (Ve la pregunta en la pantalla y lee las opciones)
```

## Recursos para practicar
- [Documentación oficial de React (¡Excelente para aprender!)](https://es.react.dev/learn)
- [MDN Web Docs sobre Canvas](https://developer.mozilla.org/es/docs/Web/API/Canvas_API)
- [Conceptos de UI/UX básicos en YouTube](https://www.youtube.com/results?search_query=ui+ux+course+for+beginners)
