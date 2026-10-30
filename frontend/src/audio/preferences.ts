export interface AudioPreferences {
  readonly muted: boolean;
  readonly volume: number;
  readonly effects: boolean;
  readonly music: boolean;
}

export type PreferenceStorage = Pick<Storage, "getItem" | "setItem">;

export const AUDIO_PREFERENCES_KEY = "trivia.audio.v1";
export const VOLUME_MIN = 0;
export const VOLUME_MAX = 100;
export const VOLUME_STEP = 5;

export const DEFAULT_AUDIO_PREFERENCES: AudioPreferences = {
  muted: true,
  volume: 60,
  effects: true,
  music: true,
};

export function isValidVolume(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= VOLUME_MIN &&
    value <= VOLUME_MAX &&
    value % VOLUME_STEP === 0
  );
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/** Validates each field on its own; an invalid field takes its default. */
export function parseAudioPreferences(raw: unknown): AudioPreferences {
  const source: Record<string, unknown> =
    typeof raw === "object" && raw !== null
      ? (raw as Record<string, unknown>)
      : {};
  const defaults = DEFAULT_AUDIO_PREFERENCES;
  return {
    muted: booleanOr(source.muted, defaults.muted),
    volume: isValidVolume(source.volume) ? source.volume : defaults.volume,
    effects: booleanOr(source.effects, defaults.effects),
    music: booleanOr(source.music, defaults.music),
  };
}

export function loadAudioPreferences(
  storage: PreferenceStorage | null,
): AudioPreferences {
  if (storage === null) return DEFAULT_AUDIO_PREFERENCES;
  try {
    const text = storage.getItem(AUDIO_PREFERENCES_KEY);
    if (text === null) return DEFAULT_AUDIO_PREFERENCES;
    return parseAudioPreferences(JSON.parse(text) as unknown);
  } catch {
    return DEFAULT_AUDIO_PREFERENCES;
  }
}

/** Returns false when the preferences could not be stored. */
export function saveAudioPreferences(
  storage: PreferenceStorage | null,
  preferences: AudioPreferences,
): boolean {
  if (storage === null) return false;
  try {
    storage.setItem(AUDIO_PREFERENCES_KEY, JSON.stringify(preferences));
    return true;
  } catch {
    return false;
  }
}

/** The browser's localStorage, or null when it is missing or blocked. */
export function browserPreferenceStorage(): PreferenceStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
