// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  AUDIO_PREFERENCES_KEY,
  DEFAULT_AUDIO_PREFERENCES,
  browserPreferenceStorage,
  isValidVolume,
  loadAudioPreferences,
  parseAudioPreferences,
  saveAudioPreferences,
} from "./preferences";
import type { PreferenceStorage } from "./preferences";

function memoryStorage(initial?: string): PreferenceStorage & {
  readonly values: Map<string, string>;
} {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set(AUDIO_PREFERENCES_KEY, initial);
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

describe("audio preferences", () => {
  it("PREF-01 the defaults are muted, volume 60, effects on and music on", () => {
    expect(DEFAULT_AUDIO_PREFERENCES).toEqual({
      muted: true,
      volume: 60,
      effects: true,
      music: true,
    });
  });

  it("PREF-02 a valid volume is an integer from 0 to 100 in steps of 5", () => {
    for (const volume of [0, 5, 60, 100])
      expect(isValidVolume(volume)).toBe(true);
    for (const volume of [-5, 105, 250, 62, 7.5, Number.NaN, "60", null]) {
      expect(isValidVolume(volume)).toBe(false);
    }
  });

  it("PREF-03 parse keeps every valid field", () => {
    expect(
      parseAudioPreferences({
        muted: false,
        volume: 30,
        effects: false,
        music: false,
      }),
    ).toEqual({ muted: false, volume: 30, effects: false, music: false });
  });

  it("PREF-04 parse replaces each invalid field with its own default", () => {
    expect(
      parseAudioPreferences({
        muted: false,
        volume: 250,
        effects: "no",
        music: 1,
      }),
    ).toEqual({ muted: false, volume: 60, effects: true, music: true });
  });

  it("PREF-05 parse of a non-object returns the defaults", () => {
    for (const raw of [null, undefined, 42, "texto", true]) {
      expect(parseAudioPreferences(raw)).toEqual(DEFAULT_AUDIO_PREFERENCES);
    }
  });

  it("PREF-06 load returns the defaults with no storage or no stored value", () => {
    expect(loadAudioPreferences(null)).toEqual(DEFAULT_AUDIO_PREFERENCES);
    expect(loadAudioPreferences(memoryStorage())).toEqual(
      DEFAULT_AUDIO_PREFERENCES,
    );
  });

  it("PREF-07 load parses the stored value per field", () => {
    const storage = memoryStorage(
      JSON.stringify({ muted: false, volume: 250, music: "x" }),
    );
    expect(loadAudioPreferences(storage)).toEqual({
      muted: false,
      volume: 60,
      effects: true,
      music: true,
    });
  });

  it("PREF-08 load returns the defaults when the stored value is not JSON", () => {
    expect(loadAudioPreferences(memoryStorage("{roto"))).toEqual(
      DEFAULT_AUDIO_PREFERENCES,
    );
  });

  it("PREF-09 load returns the defaults when getItem throws", () => {
    const storage: PreferenceStorage = {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: vi.fn(),
    };
    expect(loadAudioPreferences(storage)).toEqual(DEFAULT_AUDIO_PREFERENCES);
  });

  it("PREF-10 save writes the preferences as JSON under one key", () => {
    const storage = memoryStorage();
    const preferences = {
      muted: false,
      volume: 30,
      effects: true,
      music: false,
    };
    expect(saveAudioPreferences(storage, preferences)).toBe(true);
    expect(storage.values.get(AUDIO_PREFERENCES_KEY)).toBe(
      JSON.stringify(preferences),
    );
    expect(loadAudioPreferences(storage)).toEqual(preferences);
  });

  it("PREF-11 save reports false with no storage or when setItem throws", () => {
    expect(saveAudioPreferences(null, DEFAULT_AUDIO_PREFERENCES)).toBe(false);
    const storage: PreferenceStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("lleno");
      },
    };
    expect(saveAudioPreferences(storage, DEFAULT_AUDIO_PREFERENCES)).toBe(
      false,
    );
  });

  it("PREF-12 the browser storage is null without a window", () => {
    expect(browserPreferenceStorage()).toBeNull();
  });

  it("PREF-13 the browser storage is window.localStorage, or null when reading it throws", () => {
    const storage = memoryStorage();
    vi.stubGlobal("window", { localStorage: storage });
    expect(browserPreferenceStorage()).toBe(storage);
    vi.stubGlobal(
      "window",
      Object.defineProperty({}, "localStorage", {
        get: () => {
          throw new Error("SecurityError");
        },
      }),
    );
    expect(browserPreferenceStorage()).toBeNull();
    vi.unstubAllGlobals();
  });
});
