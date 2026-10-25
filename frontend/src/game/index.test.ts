// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  INITIAL_GAME_STATE,
  INITIAL_PHASE,
  PHASES,
  createLobbyConfig,
  gameReducer,
} from "./index";
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

  it("the barrel exposes a working reducer and lobby factory", () => {
    const config = createLobbyConfig({
      playerNames: [" Ana ", "Beto"],
      lang: "en",
      secondsPerQuestion: 30,
      rounds: 5,
    });
    expect(config).not.toBeNull();
    if (config === null) {
      throw new Error("expected a valid lobby config");
    }

    const next = gameReducer(INITIAL_GAME_STATE, {
      type: "START_GAME",
      config,
    });

    expect(next.phase).toBe("QuestionCard");
    expect(next.players).toEqual([
      { name: "Ana", score: 0 },
      { name: "Beto", score: 0 },
    ]);
    expect(next.config?.playerNames).toEqual(["Ana", "Beto"]);
  });
});
