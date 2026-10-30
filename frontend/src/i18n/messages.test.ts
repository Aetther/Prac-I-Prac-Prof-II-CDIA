// @vitest-environment node
import { describe, expect, it } from "vitest";
import { en } from "./en";
import { es } from "./es";
import type { Messages } from "./messages";

const SAMPLE_ARGS: readonly unknown[] = ["Ana", 7];

function render(messages: Messages): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(messages)) {
    if (typeof value === "function") {
      out[key] = (value as (...args: unknown[]) => string)(...SAMPLE_ARGS);
    } else if (typeof value === "string") {
      out[key] = value;
    } else {
      for (const [reason, label] of Object.entries(
        value as Record<string, string>,
      )) {
        out[`${key}.${reason}`] = label;
      }
    }
  }
  return out;
}

describe("dictionaries", () => {
  it("I18N-01 Spanish and English have exactly the same keys", () => {
    expect(Object.keys(render(en)).sort()).toEqual(
      Object.keys(render(es)).sort(),
    );
  });

  it("I18N-02 every text is non-empty in both languages", () => {
    for (const messages of [es, en]) {
      for (const [key, text] of Object.entries(render(messages))) {
        expect(text.trim(), key).not.toBe("");
      }
    }
  });

  it("I18N-03 English differs from Spanish except the shared brand-free words", () => {
    const spanish = render(es);
    const same = Object.entries(render(en))
      .filter(([key, text]) => spanish[key] === text)
      .map(([key]) => key);
    expect(same).toEqual([]);
  });

  it("I18N-04 the Spanish copy keeps the strings the game always showed", () => {
    expect(es.turnOf("Ana")).toBe("¡Turno de Ana!");
    expect(es.points("Ana", 10)).toBe("Ana: 10 puntos");
    expect(es.categoriesCount(2)).toBe("Categorías: 2 de 6");
    expect(es.turnsCount(3)).toBe("Turnos: 3 de 20");
    expect(es.roundOf(1, 3)).toBe("Ronda 1 de 3");
    expect(es.wheelResult("Historia")).toBe("¡Historia!");
    expect(es.categoryOf("Historia")).toBe("Categoría: Historia");
    expect(es.correctAnswerWas("Lima")).toBe("La respuesta correcta era: Lima");
    expect(es.youChose("Quito")).toBe("Elegiste: Quito");
    expect(es.winner("Beto")).toBe("¡Ganó Beto!");
    expect(es.categoriesOfPlayer("Ana")).toBe("Categorías de Ana");
    expect(es.secondsOption(30)).toBe("30 segundos");
    expect(es.roundsOption(5)).toBe("5 rondas");
  });

  it("I18N-05 the English copy reads naturally", () => {
    expect(en.turnOf("Ana")).toBe("Ana's turn!");
    expect(en.points("Ana", 10)).toBe("Ana: 10 points");
    expect(en.wheelResult("History")).toBe("History!");
    expect(en.winner("Beto")).toBe("Beto wins!");
    expect(en.roundOf(1, 3)).toBe("Round 1 of 3");
    expect(en.secondsOption(10)).toBe("10 seconds");
    expect(en.roundsOption(3)).toBe("3 rounds");
  });
});
