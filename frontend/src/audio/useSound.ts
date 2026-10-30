import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { browserAudioContextFactory, createAudioEngine } from "./engine";
import type { AudioContextFactory } from "./engine";
import {
  browserPreferenceStorage,
  loadAudioPreferences,
  saveAudioPreferences,
} from "./preferences";
import type { AudioPreferences, PreferenceStorage } from "./preferences";
import type { SoundEffect } from "./recipes";

/** A wheel tick closer than this to the previous one is merged into it. */
export const TICK_MIN_INTERVAL_MS = 40;

export interface SoundControls {
  readonly preferences: AudioPreferences;
  /** Each setter is meant for a user gesture: it also unlocks the audio. */
  setMuted(muted: boolean): void;
  setVolume(volume: number): void;
  setEffects(effects: boolean): void;
  setMusic(music: boolean): void;
  /** Creates or resumes the audio; call only inside a user gesture handler. */
  unlock(): void;
  play(effect: SoundEffect): void;
  /** The wheel tick, throttled to one every 40 ms. */
  tick(): void;
  startMusic(): void;
  stopMusic(): void;
}

export interface UseSoundOptions {
  readonly createContext?: AudioContextFactory;
  readonly storage?: PreferenceStorage | null;
  readonly now?: () => number;
}

function performanceNow(): number {
  return performance.now();
}

export function useSound(options: UseSoundOptions = {}): SoundControls {
  const [storage] = useState(() =>
    options.storage === undefined
      ? browserPreferenceStorage()
      : options.storage,
  );
  const [preferences, setPreferences] = useState(() =>
    loadAudioPreferences(storage),
  );
  const [engine] = useState(() =>
    createAudioEngine(
      preferences,
      options.createContext ?? browserAudioContextFactory,
    ),
  );
  const [now] = useState(() => options.now ?? performanceNow);
  const preferencesRef = useRef(preferences);
  const lastTickRef = useRef(Number.NEGATIVE_INFINITY);

  const change = useCallback(
    (patch: Partial<AudioPreferences>) => {
      const next = { ...preferencesRef.current, ...patch };
      preferencesRef.current = next;
      setPreferences(next);
      engine.setPreferences(next);
      saveAudioPreferences(storage, next);
      engine.unlock();
    },
    [engine, storage],
  );

  const setMuted = useCallback((muted: boolean) => change({ muted }), [change]);
  const setVolume = useCallback(
    (volume: number) => change({ volume }),
    [change],
  );
  const setEffects = useCallback(
    (effects: boolean) => change({ effects }),
    [change],
  );
  const setMusic = useCallback((music: boolean) => change({ music }), [change]);
  const unlock = useCallback(() => engine.unlock(), [engine]);
  const play = useCallback(
    (effect: SoundEffect) => {
      engine.play(effect);
    },
    [engine],
  );
  const tick = useCallback(() => {
    const time = now();
    if (time - lastTickRef.current < TICK_MIN_INTERVAL_MS) return;
    lastTickRef.current = time;
    engine.play("tick");
  }, [engine, now]);
  const startMusic = useCallback(() => engine.startMusic(), [engine]);
  const stopMusic = useCallback(() => engine.stopMusic(), [engine]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") engine.suspend();
      else engine.resume();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [engine]);

  return useMemo(
    () => ({
      preferences,
      setMuted,
      setVolume,
      setEffects,
      setMusic,
      unlock,
      play,
      tick,
      startMusic,
      stopMusic,
    }),
    [
      preferences,
      setMuted,
      setVolume,
      setEffects,
      setMusic,
      unlock,
      play,
      tick,
      startMusic,
      stopMusic,
    ],
  );
}
