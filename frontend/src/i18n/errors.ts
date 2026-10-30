import type { Language } from "./language";

/**
 * English for every Spanish message that `src/api` and `src/game` can show in
 * the game view. `errors.test.ts` scans those files so a new message cannot be
 * added without its English.
 */
export const ENGLISH_MESSAGES: Readonly<Record<string, string>> = {
  "¿Está corriendo la API?": "Is the API running?",
  "La solicitud tardó demasiado tiempo.": "The request took too long.",
  "Error de conexión. Verificá que la API esté corriendo.":
    "Connection error. Check that the API is running.",
  "Error en la solicitud.": "The request failed.",
  "Demasiadas solicitudes. Esperá unos segundos.":
    "Too many requests. Wait a few seconds.",
  "Recurso no encontrado.": "Resource not found.",
  "Los datos enviados no son válidos.": "The data sent is not valid.",
  "Error del servidor.": "Server error.",
  "Respuesta inválida del servidor.": "Invalid response from the server.",
  "La respuesta no es válida.": "The answer is not valid.",
  "La pregunta del reporte no es válida.":
    "The reported question is not valid.",
  "El motivo del reporte no es válido.": "The report reason is not valid.",
  "El idioma del reporte no es válido.": "The report language is not valid.",
  "El comentario del reporte no es válido.": "The report comment is not valid.",
  "El comentario no puede superar los 500 caracteres.":
    "The comment can't be longer than 500 characters.",
  "Escribí un comentario para el motivo Otro.":
    "Write a comment for the reason Other.",
  "No hay preguntas disponibles en ninguna categoría.":
    "There are no questions available in any category.",
  "No encontramos una pregunta nueva.": "We couldn't find a new question.",
  "La pregunta ya no está disponible.": "This question is no longer available.",
  "El reporte no es válido. Revisá el motivo y el comentario.":
    "The report is not valid. Check the reason and the comment.",
  "Esperá 1 segundo": "Wait 1 second",
  "Demasiados reportes. Esperá un momento y volvé a intentar.":
    "Too many reports. Wait a moment and try again.",
  "Respuesta incorrecta": "Wrong answer",
  "Error en el texto": "Typo in the text",
};

export const ENGLISH_FALLBACK_MESSAGE =
  "Something went wrong. Please try again.";

const WAIT_SECONDS = /^Esperá (\d+) segundos$/;

/** The message in the chosen language; Spanish is returned unchanged. */
export function translateMessage(message: string, language: Language): string {
  if (language === "es") return message;
  const known = ENGLISH_MESSAGES[message];
  if (known !== undefined) return known;
  const wait = WAIT_SECONDS.exec(message);
  if (wait !== null) return `Wait ${wait[1]} seconds`;
  return ENGLISH_FALLBACK_MESSAGE;
}
