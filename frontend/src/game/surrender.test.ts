// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  INITIAL_GAME_STATE,
  SURRENDER_PHASES,
  computeSurrenderResult,
  gameReducer,
  getSurrenderingPlayer,
} from "./reducer";
import type {
  GamePhase,
  GameState,
  LobbyConfig,
  SixCategoriesLobbyConfig,
} from "./types";

const rounds: LobbyConfig = {
  playerNames: ["Ana", "Beto"],
  lang: "es",
  secondsPerQuestion: 20,
  mode: "rounds",
  rounds: 3,
};

const six: SixCategoriesLobbyConfig = {
  playerNames: ["Ana", "Beto"],
  lang: "es",
  secondsPerQuestion: 20,
  mode: "six-categories",
};

function inMatch(overrides: Partial<GameState> = {}): GameState {
  return {
    ...INITIAL_GAME_STATE,
    phase: "Wheel",
    config: rounds,
    players: [
      { name: "Ana", score: 20 },
      { name: "Beto", score: 0 },
    ],
    round: 2,
    currentPlayer: 0,
    ...overrides,
  };
}

describe("surrender rules", () => {
  it("SUR-01 the four in-match phases accept a surrender and no other phase does", () => {
    expect([...SURRENDER_PHASES]).toEqual([
      "Wheel",
      "QuestionCard",
      "Result",
      "SwitchTurn",
    ]);
    for (const phase of ["Lobby", "GameOver"] as GamePhase[]) {
      const state = inMatch({ phase });
      expect(gameReducer(state, { type: "SURRENDER" })).toBe(state);
    }
    const noConfig = inMatch({ config: null });
    expect(gameReducer(noConfig, { type: "SURRENDER" })).toBe(noConfig);
  });

  it("SUR-02 the player on turn surrenders, and on SwitchTurn the player about to play", () => {
    expect(
      getSurrenderingPlayer(inMatch({ phase: "Wheel", currentPlayer: 1 })),
    ).toBe(1);
    expect(
      getSurrenderingPlayer(inMatch({ phase: "Result", currentPlayer: 0 })),
    ).toBe(0);
    expect(
      getSurrenderingPlayer(inMatch({ phase: "SwitchTurn", currentPlayer: 0 })),
    ).toBe(1);
    expect(
      getSurrenderingPlayer(inMatch({ phase: "SwitchTurn", currentPlayer: 1 })),
    ).toBe(0);
  });

  it("Surrendering on SwitchTurn gives the match to the other player", () => {
    const state = inMatch({ phase: "SwitchTurn", currentPlayer: 0 });
    const next = gameReducer(state, { type: "SURRENDER" });
    expect(next.phase).toBe("GameOver");
    expect(next.result).toEqual({
      kind: "winner",
      winnerIndex: 0,
      scores: [20, 0],
      surrenderedBy: 1,
    });
    expect(next.currentQuestion).toBeNull();
    expect(next.lastAnswer).toBeNull();
  });

  it("The trailing player can win by the other's surrender", () => {
    const state = inMatch({
      config: six,
      phase: "Wheel",
      currentPlayer: 0,
      ownedCategories: [
        ["geografia", "historia", "ciencia", "arte", "deportes"],
        [],
      ],
    });
    const next = gameReducer(state, { type: "SURRENDER" });
    expect(next.result).toEqual({
      mode: "six-categories",
      kind: "winner",
      winnerIndex: 1,
      categories: [5, 0],
      reason: "surrender",
      surrenderedBy: 0,
    });
  });

  it("SUR-03 a late question or answer after the surrender changes nothing", () => {
    const over = gameReducer(inMatch({ phase: "QuestionCard" }), {
      type: "SURRENDER",
    });
    expect(
      gameReducer(over, {
        type: "QUESTION_LOADED",
        question: {
          id: 9,
          question: "¿?",
          category: "geografia",
          options: ["a", "b", "c", "d"],
          lang: "es",
        },
      }),
    ).toBe(over);
    expect(
      gameReducer(over, {
        type: "ANSWER_RECEIVED",
        chosenAnswer: "a",
        correct: true,
        correctAnswer: "a",
        timedOut: false,
      }),
    ).toBe(over);
  });

  it("SUR-04 computeSurrenderResult ignores who is ahead in either mode", () => {
    const leader = inMatch();
    expect(computeSurrenderResult(leader, 0)).toMatchObject({
      winnerIndex: 1,
      surrenderedBy: 0,
    });
    expect(computeSurrenderResult(leader, 1)).toMatchObject({
      winnerIndex: 0,
      surrenderedBy: 1,
    });
    expect(computeSurrenderResult(inMatch({ config: null }), 0)).toEqual({
      kind: "winner",
      winnerIndex: 1,
      scores: [20, 0],
      surrenderedBy: 0,
    });
  });
});
