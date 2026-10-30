import type { Lang } from "../game/types";
import { en } from "./en";
import { es } from "./es";
import type { Messages } from "./messages";

export type Language = Lang;

export type LanguageStorage = Pick<Storage, "getItem" | "setItem">;

export const LANGUAGE_KEY = "trivia.lang.v1";
export const DEFAULT_LANGUAGE: Language = "es";
export const LANGUAGES: readonly Language[] = ["es", "en"];

export function messagesFor(language: Language): Messages {
  return language === "en" ? en : es;
}

export function parseLanguage(value: unknown): Language {
  return value === "en" || value === "es" ? value : DEFAULT_LANGUAGE;
}

export function loadLanguage(storage: LanguageStorage | null): Language {
  if (storage === null) return DEFAULT_LANGUAGE;
  try {
    return parseLanguage(storage.getItem(LANGUAGE_KEY));
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

/** Returns false when the language could not be stored. */
export function saveLanguage(
  storage: LanguageStorage | null,
  language: Language,
): boolean {
  if (storage === null) return false;
  try {
    storage.setItem(LANGUAGE_KEY, language);
    return true;
  } catch {
    return false;
  }
}

/** The browser's localStorage, or null when it is missing or blocked. */
export function browserLanguageStorage(): LanguageStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
