import {
  DEFAULT_LOBBY_SETTINGS,
  GAME_MODES,
  ROUNDS_OPTIONS,
  SECONDS_OPTIONS,
} from "./lobby";
import type { GameMode, RoundsCount, SecondsPerQuestion } from "./types";

/**
 * The last Lobby settings, kept in the browser between visits. Player names
 * are never stored here: a rematch keeps them in memory only.
 */
export interface LobbyPreferences {
  readonly secondsPerQuestion: SecondsPerQuestion;
  readonly mode: GameMode;
  readonly rounds: RoundsCount;
}

export type LobbyPreferencesStorage = Pick<Storage, "getItem" | "setItem">;

export const LOBBY_PREFERENCES_KEY = "trivia.lobby.v1";

export const DEFAULT_LOBBY_PREFERENCES: LobbyPreferences = {
  secondsPerQuestion: DEFAULT_LOBBY_SETTINGS.secondsPerQuestion,
  mode: DEFAULT_LOBBY_SETTINGS.mode,
  rounds: DEFAULT_LOBBY_SETTINGS.rounds,
};

function allowed<T>(options: readonly T[], value: unknown, fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

/** Keeps only the allowed values; anything else falls back to the default. */
export function parseLobbyPreferences(raw: string | null): LobbyPreferences {
  if (raw === null) return DEFAULT_LOBBY_PREFERENCES;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return DEFAULT_LOBBY_PREFERENCES;
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return DEFAULT_LOBBY_PREFERENCES;
  }
  const values = data as Record<string, unknown>;
  return {
    secondsPerQuestion: allowed(
      SECONDS_OPTIONS,
      values.secondsPerQuestion,
      DEFAULT_LOBBY_PREFERENCES.secondsPerQuestion,
    ),
    mode: allowed(GAME_MODES, values.mode, DEFAULT_LOBBY_PREFERENCES.mode),
    rounds: allowed(
      ROUNDS_OPTIONS,
      values.rounds,
      DEFAULT_LOBBY_PREFERENCES.rounds,
    ),
  };
}

export function loadLobbyPreferences(
  storage: LobbyPreferencesStorage | null,
): LobbyPreferences {
  if (storage === null) return DEFAULT_LOBBY_PREFERENCES;
  try {
    return parseLobbyPreferences(storage.getItem(LOBBY_PREFERENCES_KEY));
  } catch {
    return DEFAULT_LOBBY_PREFERENCES;
  }
}

/** Returns false when the settings could not be stored. */
export function saveLobbyPreferences(
  storage: LobbyPreferencesStorage | null,
  preferences: LobbyPreferences,
): boolean {
  if (storage === null) return false;
  try {
    storage.setItem(
      LOBBY_PREFERENCES_KEY,
      JSON.stringify({
        secondsPerQuestion: preferences.secondsPerQuestion,
        mode: preferences.mode,
        rounds: preferences.rounds,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

/** The browser's localStorage, or null when it is missing or blocked. */
export function browserLobbyStorage(): LobbyPreferencesStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
