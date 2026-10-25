import { describe, expect, it } from "vitest";
import { INITIAL_PHASE, PHASES } from "./index";
import type { GamePhase } from "./types";

describe("game layer", () => {
  it("has initial phase Lobby", () => {
    expect(INITIAL_PHASE).toBe("Lobby");
  });

  it("has all six phases", () => {
    expect(PHASES).toEqual([
      "Lobby",
      "Wheel",
      "QuestionCard",
      "Result",
      "SwitchTurn",
      "GameOver",
    ]);
  });

  it("types are defined correctly", () => {
    const phase: GamePhase = "Lobby";
    expect(phase).toBe("Lobby");
  });
});
