// @vitest-environment node
import { describe, expect, it } from "vitest";
import * as barrel from "./index";
import {
  INITIAL_GAME_STATE,
  INITIAL_PHASE,
  PHASES,
  TIMEOUT_ANSWER,
  TURN_LIMIT,
  applySixCategoriesAnswer,
  buildWheelCategories,
  createLobbyConfig,
  createSpinPlan,
  findCategoryLabel,
  gameReducer,
  getMatchProgress,
  getTimerSnapshot,
  isCategoryName,
  isTimerUrgent,
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
      mode: "rounds",
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

  it("the barrel exposes the countdown rules and the timeout sentinel", () => {
    const start = 1_000;

    expect(getTimerSnapshot(20, start + 20_000, start).remainingSeconds).toBe(
      20,
    );
    expect(isTimerUrgent(5_000)).toBe(true);
    expect(isTimerUrgent(5_001)).toBe(false);
    expect(TIMEOUT_ANSWER).toBe("(sin respuesta)");
  });

  it("the barrel no longer exports the retired random category picker", () => {
    expect(barrel).not.toHaveProperty("pickRandomCategory");
    expect(sectorIndexAtRotation(0)).toBe(0);
    expect(buildWheelCategories(SIX_CATEGORIES)).toHaveLength(6);
  });

  it("BRL-05 the barrel exposes the six-categories rules and progress", () => {
    expect(TURN_LIMIT).toBe(20);
    expect(
      applySixCategoriesAnswer({
        ownedCategories: [[], []],
        turnsPlayed: [0, 0],
        currentPlayer: 0,
        category: "geografia",
        correct: true,
      }),
    ).toStrictEqual({
      ownedCategories: [["geografia"], []],
      turnsPlayed: [0, 0],
      keepsTurn: true,
      result: null,
    });
    expect(
      getMatchProgress(
        {
          playerNames: ["Ana", "Beto"],
          lang: "es",
          secondsPerQuestion: 20,
          mode: "six-categories",
        },
        {
          round: 1,
          ownedCategories: [["geografia"], []],
          turnsPlayed: [2, 0],
        },
      ),
    ).toStrictEqual({
      mode: "six-categories",
      ownedCategories: [["geografia"], []],
      turnsPlayed: [2, 0],
    });
    expect(isCategoryName("otra")).toBe(false);
    expect(
      findCategoryLabel(
        [{ name: "geografia", label: "Geografía" }],
        "geografia",
      ),
    ).toBe("Geografía");
  });
});
