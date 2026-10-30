// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "./en";
import { es } from "./es";
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  LANGUAGE_KEY,
  browserLanguageStorage,
  loadLanguage,
  messagesFor,
  parseLanguage,
  saveLanguage,
} from "./language";
import type { LanguageStorage } from "./language";

function memory(
  initial?: string,
): LanguageStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set(LANGUAGE_KEY, initial);
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

const throwing: LanguageStorage = {
  getItem: () => {
    throw new Error("bloqueado");
  },
  setItem: () => {
    throw new Error("bloqueado");
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("language store", () => {
  it("LANG-01 Spanish is the default and the two languages are es and en", () => {
    expect(DEFAULT_LANGUAGE).toBe("es");
    expect(LANGUAGES).toEqual(["es", "en"]);
  });

  it("LANG-02 messagesFor picks the dictionary", () => {
    expect(messagesFor("es")).toBe(es);
    expect(messagesFor("en")).toBe(en);
  });

  it("LANG-03 parseLanguage accepts es and en and falls back to Spanish", () => {
    expect(parseLanguage("en")).toBe("en");
    expect(parseLanguage("es")).toBe("es");
    for (const value of ["fr", "EN", "", null, undefined, 1]) {
      expect(parseLanguage(value)).toBe("es");
    }
  });

  it("An invalid or failing store falls back to Spanish", () => {
    expect(loadLanguage(null)).toBe("es");
    expect(loadLanguage(memory())).toBe("es");
    expect(loadLanguage(memory("fr"))).toBe("es");
    expect(loadLanguage(throwing)).toBe("es");
    expect(loadLanguage(memory("en"))).toBe("en");
  });

  it("LANG-04 saveLanguage stores the code and reports failures", () => {
    const storage = memory();
    expect(saveLanguage(storage, "en")).toBe(true);
    expect(storage.values.get(LANGUAGE_KEY)).toBe("en");
    expect(saveLanguage(null, "en")).toBe(false);
    expect(saveLanguage(throwing, "en")).toBe(false);
  });

  it("LANG-05 the browser storage is localStorage, or null without it", () => {
    expect(browserLanguageStorage()).toBeNull();
    const storage = memory();
    vi.stubGlobal("window", { localStorage: storage });
    expect(browserLanguageStorage()).toBe(storage);
    vi.stubGlobal(
      "window",
      Object.defineProperty({}, "localStorage", {
        get: () => {
          throw new Error("SecurityError");
        },
      }),
    );
    expect(browserLanguageStorage()).toBeNull();
  });
});
