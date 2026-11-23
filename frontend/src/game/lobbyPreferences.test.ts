// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_LOBBY_PREFERENCES,
  LOBBY_PREFERENCES_KEY,
  browserLobbyStorage,
  loadLobbyPreferences,
  parseLobbyPreferences,
  saveLobbyPreferences,
} from "./lobbyPreferences";
import type { LobbyPreferencesStorage } from "./lobbyPreferences";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage: LobbyPreferencesStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
  return { storage, data };
}

const throwing: LobbyPreferencesStorage = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("lobby preferences", () => {
  it("LPREF-01 the defaults match the Lobby defaults and the key is versioned", () => {
    expect(DEFAULT_LOBBY_PREFERENCES).toEqual({
      secondsPerQuestion: 20,
      mode: "rounds",
      rounds: 5,
    });
    expect(LOBBY_PREFERENCES_KEY).toBe("trivia.lobby.v1");
  });

  it("LPREF-02 parses every allowed value", () => {
    expect(
      parseLobbyPreferences(
        JSON.stringify({
          secondsPerQuestion: 10,
          mode: "six-categories",
          rounds: 10,
        }),
      ),
    ).toEqual({ secondsPerQuestion: 10, mode: "six-categories", rounds: 10 });
  });

  it("LPREF-03 replaces each invalid value with its default and keeps the valid ones", () => {
    expect(
      parseLobbyPreferences(
        JSON.stringify({ secondsPerQuestion: 15, mode: "free", rounds: 3 }),
      ),
    ).toEqual({ secondsPerQuestion: 20, mode: "rounds", rounds: 3 });
    expect(
      parseLobbyPreferences(
        JSON.stringify({
          secondsPerQuestion: "30",
          mode: "rounds",
          rounds: "5",
        }),
      ),
    ).toEqual(DEFAULT_LOBBY_PREFERENCES);
  });

  it("LPREF-04 broken, empty or non-object data gives the defaults", () => {
    for (const raw of [null, "", "{", "null", "[]", "42", '"rounds"']) {
      expect(parseLobbyPreferences(raw), String(raw)).toEqual(
        DEFAULT_LOBBY_PREFERENCES,
      );
    }
  });

  it("LPREF-05 saves only the three settings and loads them back", () => {
    const { storage, data } = memoryStorage();
    const saved = saveLobbyPreferences(storage, {
      secondsPerQuestion: 30,
      mode: "six-categories",
      rounds: 10,
    });
    expect(saved).toBe(true);
    expect(JSON.parse(data.get(LOBBY_PREFERENCES_KEY)!)).toEqual({
      secondsPerQuestion: 30,
      mode: "six-categories",
      rounds: 10,
    });
    expect(loadLobbyPreferences(storage)).toEqual({
      secondsPerQuestion: 30,
      mode: "six-categories",
      rounds: 10,
    });
  });

  it("LPREF-06 never stores extra fields such as player names", () => {
    const { storage, data } = memoryStorage();
    const withNames = {
      secondsPerQuestion: 20,
      mode: "rounds",
      rounds: 5,
      playerNames: ["Ana", "Beto"],
    } as unknown as Parameters<typeof saveLobbyPreferences>[1];
    saveLobbyPreferences(storage, withNames);
    const stored = data.get(LOBBY_PREFERENCES_KEY)!;
    expect(stored).not.toContain("Ana");
    expect(Object.keys(JSON.parse(stored)).sort()).toEqual([
      "mode",
      "rounds",
      "secondsPerQuestion",
    ]);
  });

  it("LPREF-07 a missing or blocked storage never throws", () => {
    expect(loadLobbyPreferences(null)).toEqual(DEFAULT_LOBBY_PREFERENCES);
    expect(loadLobbyPreferences(throwing)).toEqual(DEFAULT_LOBBY_PREFERENCES);
    expect(saveLobbyPreferences(null, DEFAULT_LOBBY_PREFERENCES)).toBe(false);
    expect(saveLobbyPreferences(throwing, DEFAULT_LOBBY_PREFERENCES)).toBe(
      false,
    );
  });

  it("LPREF-08 the browser storage is localStorage, or null without it", () => {
    expect(browserLobbyStorage()).toBeNull();
    const { storage } = memoryStorage();
    vi.stubGlobal("window", { localStorage: storage });
    expect(browserLobbyStorage()).toBe(storage);
    vi.stubGlobal(
      "window",
      Object.defineProperty({}, "localStorage", {
        get: () => {
          throw new Error("SecurityError");
        },
      }),
    );
    expect(browserLobbyStorage()).toBeNull();
  });
});
