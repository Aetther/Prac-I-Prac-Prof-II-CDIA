// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeAudioContext } from "../test/fakeAudio";
import {
  MUSIC_BUS_LEVEL,
  browserAudioContextFactory,
  createAudioEngine,
  masterGainFor,
} from "./engine";
import type { AudioContextLike } from "./engine";
import { DEFAULT_AUDIO_PREFERENCES } from "./preferences";
import type { AudioPreferences } from "./preferences";
import { SOUND_RECIPES } from "./recipes";

const ON: AudioPreferences = {
  muted: false,
  volume: 100,
  effects: true,
  music: true,
};

function setup(preferences: AudioPreferences = ON) {
  const contexts: FakeAudioContext[] = [];
  const factory = vi.fn(() => {
    const context = new FakeAudioContext();
    contexts.push(context);
    return context;
  });
  const engine = createAudioEngine(preferences, factory);
  return { engine, factory, contexts, context: () => contexts[0] };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("audio engine: context and unlock", () => {
  it("ENG-01 creates no context until unlock, then exactly one", () => {
    const { engine, factory } = setup();
    expect(engine.play("correct")).toBe(false);
    engine.startMusic();
    expect(factory).not.toHaveBeenCalled();
    expect(engine.unlocked).toBe(false);
    engine.unlock();
    engine.unlock();
    expect(factory).toHaveBeenCalledTimes(1);
    expect(engine.unlocked).toBe(true);
  });

  it("ENG-02 unlock resumes the context every time it is called", () => {
    const { engine, context } = setup();
    engine.unlock();
    engine.unlock();
    expect(context().resumeCalls).toBe(2);
  });

  it("ENG-03 builds master, effects and music buses wired to the destination", () => {
    const { engine, context } = setup();
    engine.unlock();
    const ctx = context();
    expect(ctx.master.connections).toEqual([ctx.destination]);
    expect(ctx.effectsBus.connections).toEqual([ctx.master]);
    expect(ctx.musicBus.connections).toEqual([ctx.master]);
  });

  it("ENG-04 without Web Audio every call is a silent no-op", () => {
    const engine = createAudioEngine(ON, () => null);
    engine.unlock();
    engine.startMusic();
    engine.suspend();
    engine.resume();
    expect(engine.unlocked).toBe(false);
    expect(engine.play("victory")).toBe(false);
    expect(engine.musicPlaying).toBe(false);
  });

  it("ENG-05 a rejected resume or suspend does not throw", async () => {
    const context = new FakeAudioContext();
    context.resume = () => Promise.reject(new Error("bloqueado"));
    context.suspend = () => Promise.reject(new Error("bloqueado"));
    const engine = createAudioEngine(ON, () => context);
    engine.unlock();
    engine.suspend();
    engine.resume();
    await vi.runAllTimersAsync();
    expect(engine.unlocked).toBe(true);
  });

  it("ENG-06 suspend and resume reach the context once it exists", () => {
    const { engine, context } = setup();
    engine.suspend();
    engine.resume();
    engine.unlock();
    engine.suspend();
    engine.resume();
    expect(context().suspendCalls).toBe(1);
    expect(context().resumeCalls).toBe(2);
  });
});

describe("audio engine: browser factory", () => {
  it("ENG-07 returns null without a window", () => {
    expect(browserAudioContextFactory()).toBeNull();
  });

  it("ENG-08 uses AudioContext, then webkitAudioContext, then null", () => {
    vi.stubGlobal("window", { AudioContext: FakeAudioContext });
    expect(browserAudioContextFactory()).toBeInstanceOf(FakeAudioContext);
    vi.stubGlobal("window", { webkitAudioContext: FakeAudioContext });
    expect(browserAudioContextFactory()).toBeInstanceOf(FakeAudioContext);
    vi.stubGlobal("window", {});
    expect(browserAudioContextFactory()).toBeNull();
  });
});

describe("audio engine: mute, volume and effects", () => {
  it("Muted plays nothing", () => {
    const { engine, context } = setup({ ...ON, muted: true });
    engine.unlock();
    engine.startMusic();
    expect(engine.play("tick")).toBe(false);
    expect(engine.play("correct")).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(context().oscillators).toHaveLength(0);
    expect(engine.musicPlaying).toBe(false);
  });

  it("The volume maps to the master gain", () => {
    const { engine, context } = setup();
    engine.unlock();
    for (const [volume, gain] of [
      [0, 0],
      [50, 0.25],
      [100, 1],
    ] as const) {
      engine.setPreferences({ ...ON, volume });
      expect(context().master.gain.target).toBeCloseTo(gain);
    }
    engine.setPreferences({ ...ON, muted: true });
    expect(context().master.gain.target).toBe(0);
  });

  it("ENG-09 masterGainFor is zero when muted and the square of the volume otherwise", () => {
    expect(masterGainFor(DEFAULT_AUDIO_PREFERENCES)).toBe(0);
    expect(masterGainFor({ ...ON, volume: 60 })).toBeCloseTo(0.36);
  });

  it("ENG-10 gain changes are smooth targets, never jumps", () => {
    const { engine, context } = setup();
    engine.unlock();
    engine.setPreferences({ ...ON, volume: 30 });
    const kinds = context().master.gain.events.map((event) => event.kind);
    expect(kinds.every((kind) => kind === "target")).toBe(true);
  });

  it("ENG-11 effects off silences the effects bus and plays no effect", () => {
    const { engine, context } = setup({ ...ON, effects: false });
    engine.unlock();
    expect(context().effectsBus.gain.target).toBe(0);
    expect(engine.play("correct")).toBe(false);
    expect(context().oscillators).toHaveLength(0);
    engine.setPreferences(ON);
    expect(context().effectsBus.gain.target).toBe(1);
  });

  it("ENG-12 an effect plays one oscillator per recipe note on the effects bus", () => {
    const { engine, context } = setup();
    engine.unlock();
    context().currentTime = 2;
    expect(engine.play("correct")).toBe(true);
    const recipe = SOUND_RECIPES.correct;
    const oscillators = context().oscillatorsOn(context().effectsBus);
    expect(oscillators).toHaveLength(recipe.notes.length);
    oscillators.forEach((oscillator, index) => {
      const note = recipe.notes[index];
      expect(oscillator.type).toBe(recipe.type);
      expect(oscillator.frequency.events[0].value).toBe(note.frequency);
      expect(oscillator.startTime).toBeCloseTo(2 + note.start);
      expect(oscillator.stopTime).toBeGreaterThan(
        2 + note.start + note.duration,
      );
    });
  });

  it("ENG-13 every note has an attack and a release envelope", () => {
    const { engine, context } = setup();
    engine.unlock();
    engine.play("tick");
    const envelope = context().gains[3];
    expect(envelope.gain.events.map((event) => event.kind)).toEqual([
      "set",
      "linear",
      "exponential",
    ]);
    expect(envelope.gain.events[0].value).toBe(0);
    expect(envelope.gain.events[1].value).toBe(SOUND_RECIPES.tick.peak);
  });
});

describe("audio engine: music", () => {
  it("ENG-14 music plays only when wanted, unlocked, unmuted and switched on", () => {
    const { engine, context } = setup();
    engine.startMusic();
    expect(engine.musicPlaying).toBe(false);
    engine.unlock();
    expect(engine.musicPlaying).toBe(true);
    expect(context().musicBus.gain.target).toBe(MUSIC_BUS_LEVEL);
    expect(context().oscillatorsOn(context().musicBus).length).toBeGreaterThan(
      0,
    );
  });

  it("ENG-15 turning music off or muting stops it at once, and turning it back resumes", () => {
    const { engine, context } = setup();
    engine.unlock();
    engine.startMusic();
    engine.setPreferences({ ...ON, music: false });
    expect(engine.musicPlaying).toBe(false);
    expect(context().musicBus.gain.target).toBe(0);
    engine.setPreferences(ON);
    expect(engine.musicPlaying).toBe(true);
    engine.setPreferences({ ...ON, muted: true });
    expect(engine.musicPlaying).toBe(false);
  });

  it("ENG-16 stopMusic stops scheduling notes and silences the music bus", () => {
    const { engine, context } = setup();
    engine.unlock();
    engine.startMusic();
    vi.advanceTimersByTime(500);
    engine.stopMusic();
    const count = context().oscillators.length;
    context().currentTime = 10;
    vi.advanceTimersByTime(1000);
    expect(context().oscillators).toHaveLength(count);
    expect(context().musicBus.gain.target).toBe(0);
  });

  it("ENG-17 effects keep playing while the music is on and are louder", () => {
    const { engine, context } = setup();
    engine.unlock();
    engine.startMusic();
    expect(engine.play("correct")).toBe(true);
    expect(context().effectsBus.gain.target).toBeGreaterThan(MUSIC_BUS_LEVEL);
  });

  it("ENG-18 music notes use the context that exists when they are scheduled", () => {
    const context = new FakeAudioContext();
    const engine = createAudioEngine(ON, (): AudioContextLike => context);
    engine.unlock();
    engine.startMusic();
    const types = new Set(
      context.oscillatorsOn(context.musicBus).map((o) => o.type),
    );
    expect(
      [...types].every((type) => type === "triangle" || type === "square"),
    ).toBe(true);
  });
});
