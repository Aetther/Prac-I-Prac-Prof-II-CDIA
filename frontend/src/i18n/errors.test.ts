// @vitest-environment node
import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import {
  ENGLISH_FALLBACK_MESSAGE,
  ENGLISH_MESSAGES,
  translateMessage,
} from "./errors";

const GAME_MESSAGE_SOURCES = [
  "api/client.ts",
  "api/game.ts",
  "api/reports.ts",
  "api/validation.ts",
  "game/question.ts",
  "game/errors.ts",
  "game/reporting.ts",
];

/** Double-quoted sentences: start with a capital or ¿ and hold a space. */
function spanishMessages(file: string): string[] {
  const text = readFileSync(join(process.cwd(), "src", file), "utf-8");
  return [...text.matchAll(/"([A-ZÁÉÍÓÚ¿¡][^"]* [^"]*)"/g)].map(
    (match) => match[1],
  );
}

describe("translateMessage", () => {
  it("ERR-I18N-01 Spanish is returned unchanged, known or not", () => {
    expect(translateMessage("¿Está corriendo la API?", "es")).toBe(
      "¿Está corriendo la API?",
    );
    expect(translateMessage("algo nuevo", "es")).toBe("algo nuevo");
  });

  it("A network error in English", () => {
    expect(translateMessage("¿Está corriendo la API?", "en")).toBe(
      "Is the API running?",
    );
  });

  it("ERR-I18N-02 the wait message keeps its number in English", () => {
    expect(translateMessage("Esperá 1 segundo", "en")).toBe("Wait 1 second");
    expect(translateMessage("Esperá 12 segundos", "en")).toBe(
      "Wait 12 seconds",
    );
  });

  it("ERR-I18N-03 an unknown message falls back to a generic English sentence", () => {
    expect(translateMessage("Mensaje que nadie tradujo.", "en")).toBe(
      ENGLISH_FALLBACK_MESSAGE,
    );
  });

  it("ERR-I18N-04 every Spanish message in the game sources has its English", () => {
    const found = new Set(GAME_MESSAGE_SOURCES.flatMap(spanishMessages));
    expect(found.size).toBeGreaterThan(15);
    const missing = [...found].filter(
      (message) => ENGLISH_MESSAGES[message] === undefined,
    );
    expect(missing).toEqual([]);
  });

  it("ERR-I18N-05 every English entry is non-empty and different from its Spanish", () => {
    for (const [spanish, english] of Object.entries(ENGLISH_MESSAGES)) {
      expect(english.trim()).not.toBe("");
      expect(english).not.toBe(spanish);
    }
  });
});
