// @vitest-environment node
import { describe, expect, it } from "vitest";
import * as barrel from "./index";
import {
  INITIAL_GAME_STATE,
  INITIAL_PHASE,
  PHASES,
  buildWheelCategories,
  createLobbyConfig,
  createSpinPlan,
  gameReducer,
  sectorIndexAtRotation,
} from "./index";
import { SIX_CATEGORIES } from "../test/wheelFixtures";
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

  it("the barrel starts a match on the Wheel and confirms the category", () => {
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

    const started = gameReducer(INITIAL_GAME_STATE, {
      type: "START_GAME",
      config,
    });

    expect(started.phase).toBe("Wheel");
    expect(started.players).toEqual([
      { name: "Ana", score: 0 },
      { name: "Beto", score: 0 },
    ]);
    expect(started.config?.playerNames).toEqual(["Ana", "Beto"]);

    const confirmed = gameReducer(started, { type: "CATEGORY_CONFIRMED" });

    expect(confirmed.phase).toBe("QuestionCard");
    expect(confirmed.currentQuestion).toBeNull();
  });

  it("the barrel exposes the wheel math", () => {
    expect(sectorIndexAtRotation(0)).toBe(0);
    expect(createSpinPlan(0, () => 0).durationMs).toBe(4000);
    expect(buildWheelCategories(SIX_CATEGORIES)).toHaveLength(6);
  });

  it("the barrel no longer exports the retired random category picker", () => {
    expect(barrel).not.toHaveProperty("pickRandomCategory");
    expect(sectorIndexAtRotation(0)).toBe(0);
    expect(buildWheelCategories(SIX_CATEGORIES)).toHaveLength(6);
  });
});
