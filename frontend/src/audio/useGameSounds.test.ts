import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { GameState, LastAnswer } from "../game/types";
import {
  isMatchInProgress,
  outcomeEffect,
  useGameSounds,
} from "./useGameSounds";

type GameView = Pick<GameState, "phase" | "lastAnswer">;

const correct: LastAnswer = {
  chosenAnswer: "Boca",
  correct: true,
  correctAnswer: "Boca",
  timedOut: false,
};
const wrong: LastAnswer = { ...correct, chosenAnswer: "River", correct: false };
const timedOut: LastAnswer = {
  ...correct,
  chosenAnswer: null,
  correct: false,
  timedOut: true,
};

function setup(initial: GameView) {
  const sound = { play: vi.fn(), startMusic: vi.fn(), stopMusic: vi.fn() };
  const view = renderHook(
    ({ game }: { game: GameView }) => useGameSounds(sound, game),
    {
      initialProps: { game: initial },
    },
  );
  return { sound, ...view };
}

describe("useGameSounds", () => {
  it("GS-01 outcomeEffect maps timeout first, then correct and wrong", () => {
    expect(outcomeEffect(correct)).toBe("correct");
    expect(outcomeEffect(wrong)).toBe("wrong");
    expect(outcomeEffect(timedOut)).toBe("timeout");
    expect(outcomeEffect({ correct: true, timedOut: true })).toBe("timeout");
  });

  it("GS-02 a match is in progress on every phase except the Lobby and GameOver", () => {
    expect(isMatchInProgress("Lobby")).toBe(false);
    expect(isMatchInProgress("GameOver")).toBe(false);
    for (const phase of [
      "Wheel",
      "QuestionCard",
      "Result",
      "SwitchTurn",
    ] as const) {
      expect(isMatchInProgress(phase)).toBe(true);
    }
  });

  it("The music starts with JUGAR and stops in the Lobby", () => {
    const { sound, rerender } = setup({ phase: "Lobby", lastAnswer: null });
    expect(sound.stopMusic).toHaveBeenCalledTimes(1);
    expect(sound.startMusic).not.toHaveBeenCalled();
    rerender({ game: { phase: "Wheel", lastAnswer: null } });
    expect(sound.startMusic).toHaveBeenCalledTimes(1);
    rerender({ game: { phase: "QuestionCard", lastAnswer: null } });
    expect(sound.startMusic).toHaveBeenCalledTimes(1);
    rerender({ game: { phase: "Lobby", lastAnswer: null } });
    expect(sound.stopMusic).toHaveBeenCalledTimes(2);
  });

  it("Each outcome has its own sound", () => {
    const { sound, rerender } = setup({
      phase: "QuestionCard",
      lastAnswer: null,
    });
    rerender({ game: { phase: "Result", lastAnswer: correct } });
    rerender({ game: { phase: "Wheel", lastAnswer: null } });
    rerender({ game: { phase: "Result", lastAnswer: wrong } });
    rerender({ game: { phase: "Wheel", lastAnswer: null } });
    rerender({ game: { phase: "Result", lastAnswer: timedOut } });
    expect(sound.play.mock.calls).toEqual([
      ["correct"],
      ["wrong"],
      ["timeout"],
    ]);
  });

  it("Reporting from Result does not replay the sound", () => {
    const { sound, rerender } = setup({
      phase: "QuestionCard",
      lastAnswer: null,
    });
    rerender({ game: { phase: "Result", lastAnswer: correct } });
    rerender({ game: { phase: "Result", lastAnswer: correct } });
    rerender({ game: { phase: "Result", lastAnswer: correct } });
    expect(sound.play).toHaveBeenCalledTimes(1);
  });

  it("GS-03 a lastAnswer outside Result plays nothing", () => {
    const { sound } = setup({ phase: "SwitchTurn", lastAnswer: correct });
    expect(sound.play).not.toHaveBeenCalled();
  });

  it("GameOver plays the fanfare once and stops the music", () => {
    const { sound, rerender } = setup({ phase: "Result", lastAnswer: correct });
    sound.play.mockClear();
    sound.stopMusic.mockClear();
    rerender({ game: { phase: "GameOver", lastAnswer: null } });
    rerender({ game: { phase: "GameOver", lastAnswer: null } });
    expect(sound.play.mock.calls).toEqual([["victory"]]);
    expect(sound.stopMusic).toHaveBeenCalledTimes(1);
  });

  it("GS-04 unmounting the game view stops the music", () => {
    const { sound, unmount } = setup({ phase: "Wheel", lastAnswer: null });
    sound.stopMusic.mockClear();
    unmount();
    expect(sound.stopMusic).toHaveBeenCalledTimes(1);
  });
});
