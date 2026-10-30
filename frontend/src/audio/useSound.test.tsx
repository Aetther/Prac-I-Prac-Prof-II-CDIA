import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { FakeAudioContext, installFakeAudio } from "../test/fakeAudio";
import { AUDIO_PREFERENCES_KEY } from "./preferences";
import type { PreferenceStorage } from "./preferences";
import { SOUND_RECIPES } from "./recipes";
import { useSound } from "./useSound";

function renderSound(options: Parameters<typeof useSound>[0] = {}) {
  return renderHook(() => useSound(options));
}

function setVisibility(state: "hidden" | "visible") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  localStorage.clear();
  installFakeAudio();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("useSound", () => {
  it("The first visit is muted with the defaults", () => {
    const { result } = renderSound();
    expect(result.current.preferences).toEqual({
      muted: true,
      volume: 60,
      effects: true,
      music: true,
    });
  });

  it("A change is remembered on the next visit", () => {
    const first = renderSound();
    act(() => first.result.current.setMuted(false));
    act(() => first.result.current.setVolume(30));
    act(() => first.result.current.setMusic(false));
    first.unmount();
    const second = renderSound();
    expect(second.result.current.preferences).toEqual({
      muted: false,
      volume: 30,
      effects: true,
      music: false,
    });
    expect(
      JSON.parse(localStorage.getItem(AUDIO_PREFERENCES_KEY) ?? "{}"),
    ).toEqual(second.result.current.preferences);
  });

  it("Invalid or failing storage falls back per field", () => {
    localStorage.setItem(
      AUDIO_PREFERENCES_KEY,
      JSON.stringify({ muted: false, volume: 250, music: "x" }),
    );
    expect(renderSound().result.current.preferences).toEqual({
      muted: false,
      volume: 60,
      effects: true,
      music: true,
    });
    const throwing: PreferenceStorage = {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
    };
    const { result } = renderSound({ storage: throwing });
    expect(result.current.preferences.muted).toBe(true);
    act(() => result.current.setEffects(false));
    expect(result.current.preferences.effects).toBe(false);
  });

  it("Opening the game creates no audio context", () => {
    localStorage.setItem(
      AUDIO_PREFERENCES_KEY,
      JSON.stringify({ muted: false }),
    );
    const { result } = renderSound();
    act(() => {
      result.current.play("correct");
      result.current.tick();
      result.current.startMusic();
    });
    expect(FakeAudioContext.instances).toHaveLength(0);
  });

  it("USE-01 every setter unlocks the audio inside its gesture", () => {
    const { result } = renderSound();
    act(() => result.current.setVolume(40));
    expect(FakeAudioContext.instances).toHaveLength(1);
    expect(FakeAudioContext.instances[0].resumeCalls).toBe(1);
    act(() => result.current.unlock());
    expect(FakeAudioContext.instances).toHaveLength(1);
    expect(FakeAudioContext.instances[0].resumeCalls).toBe(2);
  });

  it("USE-02 the setters and actions keep their identity across preference changes", () => {
    const { result } = renderSound();
    const before = result.current;
    act(() => result.current.setMuted(false));
    expect(result.current).not.toBe(before);
    for (const key of [
      "setMuted",
      "setVolume",
      "setEffects",
      "setMusic",
      "unlock",
      "play",
      "tick",
      "startMusic",
      "stopMusic",
    ] as const) {
      expect(result.current[key]).toBe(before[key]);
    }
  });

  it("Each sector crossing ticks", () => {
    let now = 1000;
    const { result } = renderSound({ now: () => now });
    act(() => result.current.setMuted(false));
    const context = FakeAudioContext.instances[0];
    for (let index = 0; index < 3; index += 1) {
      result.current.tick();
      now += 100;
    }
    expect(context.effectFrequencies()).toEqual([1800, 1800, 1800]);
  });

  it("Ticks closer than 40 ms are merged", () => {
    let now = 1000;
    const { result } = renderSound({ now: () => now });
    act(() => result.current.setMuted(false));
    const context = FakeAudioContext.instances[0];
    result.current.tick();
    now += 10;
    result.current.tick();
    now += 30;
    result.current.tick();
    expect(context.effectFrequencies()).toEqual([1800, 1800]);
  });

  it("USE-03 the default clock is performance.now", () => {
    const spy = vi.spyOn(performance, "now").mockReturnValue(5000);
    const { result } = renderSound();
    act(() => result.current.setMuted(false));
    result.current.tick();
    result.current.tick();
    expect(spy).toHaveBeenCalled();
    expect(FakeAudioContext.instances[0].effectFrequencies()).toEqual([1800]);
    spy.mockRestore();
  });

  it("USE-04 play forwards the effect to the engine", () => {
    const { result } = renderSound();
    act(() => result.current.setMuted(false));
    result.current.play("victory");
    expect(FakeAudioContext.instances[0].effectFrequencies()).toEqual(
      SOUND_RECIPES.victory.notes.map((note) => note.frequency),
    );
  });

  it("USE-05 startMusic and stopMusic drive the music scheduler", () => {
    vi.useFakeTimers();
    const { result } = renderSound();
    act(() => result.current.setMuted(false));
    const context = FakeAudioContext.instances[0];
    result.current.startMusic();
    expect(context.musicBus.gain.target).toBeGreaterThan(0);
    result.current.stopMusic();
    expect(context.musicBus.gain.target).toBe(0);
  });

  it("A hidden page suspends the audio", () => {
    const { result, unmount } = renderSound();
    act(() => result.current.setMuted(false));
    const context = FakeAudioContext.instances[0];
    setVisibility("hidden");
    expect(context.suspendCalls).toBe(1);
    setVisibility("visible");
    expect(context.resumeCalls).toBe(2);
    unmount();
    setVisibility("hidden");
    expect(context.suspendCalls).toBe(1);
  });

  it("USE-06 the injected context factory is used instead of the browser one", () => {
    const factory = vi.fn(() => null);
    const { result } = renderSound({ createContext: factory });
    act(() => result.current.setMuted(false));
    expect(factory).toHaveBeenCalledTimes(1);
    expect(FakeAudioContext.instances).toHaveLength(0);
  });
});
