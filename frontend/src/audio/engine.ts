import { MUSIC_VOICES } from "./music";
import type { AudioPreferences } from "./preferences";
import { SOUND_RECIPES } from "./recipes";
import type { OscillatorKind, SoundEffect } from "./recipes";
import { createMusicScheduler } from "./scheduler";
import type { MusicScheduler } from "./scheduler";

export interface AudioParamLike {
  value: number;
  setValueAtTime(value: number, time: number): unknown;
  linearRampToValueAtTime(value: number, time: number): unknown;
  exponentialRampToValueAtTime(value: number, time: number): unknown;
  setTargetAtTime(value: number, time: number, timeConstant: number): unknown;
}

export interface AudioNodeLike {
  connect(destination: AudioNodeLike): unknown;
}

export interface GainNodeLike extends AudioNodeLike {
  readonly gain: AudioParamLike;
}

export interface OscillatorNodeLike extends AudioNodeLike {
  type: OscillatorKind;
  readonly frequency: AudioParamLike;
  start(when: number): void;
  stop(when: number): void;
}

/** The part of the Web Audio `AudioContext` this module uses. */
export interface AudioContextLike {
  readonly currentTime: number;
  readonly destination: AudioNodeLike;
  createGain(): GainNodeLike;
  createOscillator(): OscillatorNodeLike;
  resume(): Promise<void>;
  suspend(): Promise<void>;
}

export type AudioContextFactory = () => AudioContextLike | null;

export interface AudioEngine {
  /** Creates or resumes the context; call only inside a user gesture handler. */
  unlock(): void;
  setPreferences(preferences: AudioPreferences): void;
  /** Plays an effect; returns false when nothing was played. */
  play(effect: SoundEffect): boolean;
  startMusic(): void;
  stopMusic(): void;
  suspend(): void;
  resume(): void;
  readonly unlocked: boolean;
  readonly musicPlaying: boolean;
}

export const MUSIC_BUS_LEVEL = 0.35;
export const GAIN_TIME_CONSTANT = 0.015;
export const ATTACK_SECONDS = 0.005;
export const RELEASE_FLOOR = 0.0001;
export const STOP_PADDING_SECONDS = 0.02;

type AudioContextConstructor = new () => AudioContextLike;

/** The browser's AudioContext, or null where Web Audio is unavailable. */
export function browserAudioContextFactory(): AudioContextLike | null {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as {
    AudioContext?: AudioContextConstructor;
    webkitAudioContext?: AudioContextConstructor;
  };
  const Context = scope.AudioContext ?? scope.webkitAudioContext;
  return Context === undefined ? null : new Context();
}

/** Master gain for the preferences: silent when muted, (volume / 100)² otherwise. */
export function masterGainFor(preferences: AudioPreferences): number {
  return preferences.muted ? 0 : (preferences.volume / 100) ** 2;
}

interface Graph {
  readonly context: AudioContextLike;
  readonly master: GainNodeLike;
  readonly effects: GainNodeLike;
  readonly music: GainNodeLike;
  readonly scheduler: MusicScheduler;
}

function playNote(
  context: AudioContextLike,
  bus: GainNodeLike,
  type: OscillatorKind,
  peak: number,
  frequency: number,
  when: number,
  duration: number,
): void {
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, when);
  envelope.gain.setValueAtTime(0, when);
  envelope.gain.linearRampToValueAtTime(peak, when + ATTACK_SECONDS);
  envelope.gain.exponentialRampToValueAtTime(RELEASE_FLOOR, when + duration);
  oscillator.connect(envelope);
  envelope.connect(bus);
  oscillator.start(when);
  oscillator.stop(when + duration + STOP_PADDING_SECONDS);
}

function buildGraph(context: AudioContextLike): Graph {
  const master = context.createGain();
  const effects = context.createGain();
  const music = context.createGain();
  master.gain.value = 0;
  effects.gain.value = 0;
  music.gain.value = 0;
  effects.connect(master);
  music.connect(master);
  master.connect(context.destination);
  const scheduler = createMusicScheduler(
    () => context.currentTime,
    (note, when) => {
      const voice = MUSIC_VOICES[note.voice];
      playNote(
        context,
        music,
        voice.type,
        voice.peak,
        note.frequency,
        when,
        note.duration,
      );
    },
  );
  return { context, master, effects, music, scheduler };
}

function ignore(): void {
  // A rejected resume or suspend leaves the game silent, never broken.
}

export function createAudioEngine(
  initialPreferences: AudioPreferences,
  createContext: AudioContextFactory = browserAudioContextFactory,
): AudioEngine {
  let preferences = initialPreferences;
  let graph: Graph | null = null;
  let musicWanted = false;

  function applyGains(target: Graph): void {
    const now = target.context.currentTime;
    const musicLevel =
      preferences.music && target.scheduler.running ? MUSIC_BUS_LEVEL : 0;
    target.master.gain.setTargetAtTime(
      masterGainFor(preferences),
      now,
      GAIN_TIME_CONSTANT,
    );
    target.effects.gain.setTargetAtTime(
      preferences.effects ? 1 : 0,
      now,
      GAIN_TIME_CONSTANT,
    );
    target.music.gain.setTargetAtTime(musicLevel, now, GAIN_TIME_CONSTANT);
  }

  function updateMusic(): void {
    if (graph === null) return;
    const shouldPlay = musicWanted && !preferences.muted && preferences.music;
    if (shouldPlay && !graph.scheduler.running) graph.scheduler.start();
    if (!shouldPlay && graph.scheduler.running) graph.scheduler.stop();
    applyGains(graph);
  }

  return {
    unlock() {
      if (graph === null) {
        const context = createContext();
        if (context === null) return;
        graph = buildGraph(context);
      }
      graph.context.resume().catch(ignore);
      updateMusic();
    },
    setPreferences(next) {
      preferences = next;
      updateMusic();
    },
    play(effect) {
      if (graph === null || preferences.muted || !preferences.effects)
        return false;
      const recipe = SOUND_RECIPES[effect];
      const start = graph.context.currentTime;
      for (const note of recipe.notes) {
        playNote(
          graph.context,
          graph.effects,
          recipe.type,
          recipe.peak,
          note.frequency,
          start + note.start,
          note.duration,
        );
      }
      return true;
    },
    startMusic() {
      musicWanted = true;
      updateMusic();
    },
    stopMusic() {
      musicWanted = false;
      updateMusic();
    },
    suspend() {
      if (graph !== null) graph.context.suspend().catch(ignore);
    },
    resume() {
      if (graph !== null) graph.context.resume().catch(ignore);
    },
    get unlocked() {
      return graph !== null;
    },
    get musicPlaying() {
      return graph !== null && graph.scheduler.running;
    },
  };
}
