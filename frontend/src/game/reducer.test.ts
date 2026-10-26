// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { GameQuestion } from "../api/types";
import type {
  GameAction,
  GameState,
  LobbyConfig,
  Player,
  PlayerIndex,
  RoundsCount,
} from "./types";
import {
  INITIAL_GAME_STATE,
  advanceTurn,
  computeGameResult,
  gameReducer,
  getCurrentPlayer,
  getNextTurn,
  isMatchComplete,
} from "./reducer";

const config: LobbyConfig = {
  playerNames: ["Ana", "Beto"],
  lang: "es",
  secondsPerQuestion: 20,
  mode: "rounds",
  rounds: 3,
};

function question(id = 42): GameQuestion {
  return {
    id,
    question: "¿Capital de Francia?",
    category: "geografia",
    options: ["Lima", "Quito", "Bogotá", "Buenos Aires"],
    lang: "es",
  };
}

function stateWith(overrides: Partial<GameState> = {}): GameState {
  return { ...INITIAL_GAME_STATE, ...overrides };
}

const started: GameState = gameReducer(INITIAL_GAME_STATE, {
  type: "START_GAME",
  config,
});

const confirmed: GameState = gameReducer(started, {
  type: "CATEGORY_CONFIRMED",
});

const questionLoaded: GameState = gameReducer(confirmed, {
  type: "QUESTION_LOADED",
  question: question(),
});

const players = (
  firstScore: number,
  secondScore: number,
): readonly [Player, Player] => [
  { name: "Ana", score: firstScore },
  { name: "Beto", score: secondScore },
];

function feedbackState(overrides: Partial<GameState> = {}): GameState {
  return stateWith({
    phase: "QuestionCard",
    config,
    players: players(10, 0),
    round: 1,
    currentPlayer: 0,
    usedQuestionIds: [42],
    currentQuestion: question(),
    lastAnswer: {
      chosenAnswer: "Lima",
      correct: true,
      correctAnswer: "Lima",
    },
    ...overrides,
  });
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.freeze(value);
    for (const key of Object.keys(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

describe("game reducer", () => {
  it("starts in Lobby with the initial state", () => {
    expect(INITIAL_GAME_STATE).toEqual({
      phase: "Lobby",
      config: null,
      players: [
        { name: "", score: 0 },
        { name: "", score: 0 },
      ],
      round: 0,
      currentPlayer: 0,
      usedQuestionIds: [],
      currentQuestion: null,
      lastAnswer: null,
      result: null,
    });
  });

  it("START_GAME stores the config and starts round 1 on the Wheel", () => {
    expect(started).toEqual({
      phase: "Wheel",
      config,
      players: [
        { name: "Ana", score: 0 },
        { name: "Beto", score: 0 },
      ],
      round: 1,
      currentPlayer: 0,
      usedQuestionIds: [],
      currentQuestion: null,
      lastAnswer: null,
      result: null,
    });
  });

  it("START_GAME outside the lobby returns the same state", () => {
    expect(gameReducer(started, { type: "START_GAME", config })).toBe(started);
  });

  it("QUESTION_LOADED stores the question, appends its id and clears stale feedback", () => {
    const staleResult = { kind: "tie" as const, scores: [0, 0] as const };
    const previous = feedbackState({
      currentQuestion: null,
      result: staleResult,
    });

    const next = gameReducer(previous, {
      type: "QUESTION_LOADED",
      question: question(43),
    });

    expect(next.currentQuestion).toEqual(question(43));
    expect(next.usedQuestionIds).toEqual([42, 43]);
    expect(next.lastAnswer).toBeNull();
    expect(next.result).toBe(staleResult);
  });

  it("QUESTION_LOADED outside the question phase returns the same state", () => {
    expect(
      gameReducer(INITIAL_GAME_STATE, {
        type: "QUESTION_LOADED",
        question: question(),
      }),
    ).toBe(INITIAL_GAME_STATE);
  });

  it("ANSWER_RECEIVED correct adds 10 and keeps the QuestionCard phase", () => {
    const next = gameReducer(questionLoaded, {
      type: "ANSWER_RECEIVED",
      chosenAnswer: "Lima",
      correct: true,
      correctAnswer: "Lima",
    });

    expect(next.players).toEqual([
      { name: "Ana", score: 10 },
      { name: "Beto", score: 0 },
    ]);
    expect(next.phase).toBe("QuestionCard");
    expect(next.lastAnswer).toEqual({
      chosenAnswer: "Lima",
      correct: true,
      correctAnswer: "Lima",
    });
    expect(next.result).toBeNull();
    expect(next.round).toBe(1);
    expect(next.currentPlayer).toBe(0);
    expect(next.usedQuestionIds).toEqual([42]);
  });

  it("ANSWER_RECEIVED incorrect adds nothing and sets the exact feedback", () => {
    const next = gameReducer(questionLoaded, {
      type: "ANSWER_RECEIVED",
      chosenAnswer: "Lima",
      correct: false,
      correctAnswer: "Buenos Aires",
    });

    expect(next.players).toEqual([
      { name: "Ana", score: 0 },
      { name: "Beto", score: 0 },
    ]);
    expect(next.phase).toBe("QuestionCard");
    expect(next.lastAnswer).toEqual({
      chosenAnswer: "Lima",
      correct: false,
      correctAnswer: "Buenos Aires",
    });
  });

  it("ANSWER_RECEIVED correct adds 10 to player 2", () => {
    const playerTwoTurn = stateWith({
      phase: "QuestionCard",
      config,
      players: players(10, 0),
      round: 1,
      currentPlayer: 1,
      currentQuestion: question(),
    });

    const next = gameReducer(playerTwoTurn, {
      type: "ANSWER_RECEIVED",
      chosenAnswer: "Lima",
      correct: true,
      correctAnswer: "Lima",
    });

    expect(next.players).toEqual([
      { name: "Ana", score: 10 },
      { name: "Beto", score: 10 },
    ]);
  });

  it("ANSWER_RECEIVED without a question or config returns the same state", () => {
    const wrongPhase = stateWith({
      phase: "SwitchTurn",
      config,
      currentQuestion: question(),
    });
    const noQuestion = stateWith({
      phase: "QuestionCard",
      config,
      currentQuestion: null,
    });
    const noConfig = stateWith({
      phase: "QuestionCard",
      config: null,
      currentQuestion: question(),
    });
    const action: GameAction = {
      type: "ANSWER_RECEIVED",
      chosenAnswer: "Lima",
      correct: true,
      correctAnswer: "Lima",
    };

    expect(gameReducer(wrongPhase, action)).toBe(wrongPhase);
    expect(gameReducer(noQuestion, action)).toBe(noQuestion);
    expect(gameReducer(noConfig, action)).toBe(noConfig);
  });

  it("a second ANSWER_RECEIVED after feedback returns the same state", () => {
    const feedback = feedbackState();

    const next = gameReducer(feedback, {
      type: "ANSWER_RECEIVED",
      chosenAnswer: "Quito",
      correct: true,
      correctAnswer: "Lima",
    });

    expect(next).toBe(feedback);
    expect(next.players[0].score).toBe(10);
  });

  it("the final ANSWER_RECEIVED computes the exact winner and stays in QuestionCard", () => {
    const finalTurn = stateWith({
      phase: "QuestionCard",
      config,
      players: players(30, 0),
      round: 3,
      currentPlayer: 1,
      usedQuestionIds: [1, 2, 3, 4, 5],
      currentQuestion: question(6),
    });

    const next = gameReducer(finalTurn, {
      type: "ANSWER_RECEIVED",
      chosenAnswer: "Lima",
      correct: true,
      correctAnswer: "Lima",
    });

    expect(next.result).toEqual({
      kind: "winner",
      winnerIndex: 0,
      scores: [30, 10],
    });
    expect(next.phase).toBe("QuestionCard");
    expect(next.lastAnswer).toEqual({
      chosenAnswer: "Lima",
      correct: true,
      correctAnswer: "Lima",
    });
  });

  it("the final ANSWER_RECEIVED with equal scores computes an exact tie", () => {
    const finalTurn = stateWith({
      phase: "QuestionCard",
      config,
      players: players(10, 0),
      round: 3,
      currentPlayer: 1,
      currentQuestion: question(6),
    });

    const next = gameReducer(finalTurn, {
      type: "ANSWER_RECEIVED",
      chosenAnswer: "Lima",
      correct: true,
      correctAnswer: "Lima",
    });

    expect(next.result).toEqual({ kind: "tie", scores: [10, 10] });
    expect(next.phase).toBe("QuestionCard");
  });

  it("computes the second player as the winner", () => {
    expect(computeGameResult(players(10, 30))).toEqual({
      kind: "winner",
      winnerIndex: 1,
      scores: [10, 30],
    });
  });

  it("CONTINUE_AFTER_ANSWER without a result moves to SwitchTurn and clears the feedback", () => {
    const feedback = feedbackState({ result: null });

    const next = gameReducer(feedback, { type: "CONTINUE_AFTER_ANSWER" });

    expect(next.phase).toBe("SwitchTurn");
    expect(next.lastAnswer).toBeNull();
    expect(next.currentQuestion).toBeNull();
    expect(next.result).toBeNull();
    expect(next.players).toEqual(feedback.players);
    expect(next.round).toBe(1);
    expect(next.currentPlayer).toBe(0);
    expect(next.usedQuestionIds).toEqual([42]);
  });

  it("CONTINUE_AFTER_ANSWER with a result moves to GameOver and keeps it", () => {
    const result = {
      kind: "winner" as const,
      winnerIndex: 0 as const,
      scores: [30, 10] as const,
    };
    const feedback = feedbackState({ result });

    const next = gameReducer(feedback, { type: "CONTINUE_AFTER_ANSWER" });

    expect(next.phase).toBe("GameOver");
    expect(next.result).toBe(result);
    expect(next.lastAnswer).toBeNull();
    expect(next.currentQuestion).toBeNull();
    expect(next.players).toEqual(feedback.players);
  });

  it("CONTINUE_AFTER_ANSWER without feedback returns the same state", () => {
    const noFeedback = feedbackState({ lastAnswer: null });

    expect(gameReducer(noFeedback, { type: "CONTINUE_AFTER_ANSWER" })).toBe(
      noFeedback,
    );
    expect(
      gameReducer(INITIAL_GAME_STATE, { type: "CONTINUE_AFTER_ANSWER" }),
    ).toBe(INITIAL_GAME_STATE);
  });

  it("getNextTurn alternates from player 1 to player 2 in the same round", () => {
    expect(getNextTurn(stateWith({ round: 1, currentPlayer: 0 }))).toEqual({
      currentPlayer: 1,
      round: 1,
    });
  });

  it("getNextTurn advances from player 2 to player 1 in the next round", () => {
    expect(getNextTurn(stateWith({ round: 1, currentPlayer: 1 }))).toEqual({
      currentPlayer: 0,
      round: 2,
    });
  });

  it("advanceTurn moves the turn, enters the Wheel and clears the question, feedback and result", () => {
    const playerOneTurn = stateWith({
      phase: "SwitchTurn",
      config,
      players: players(10, 0),
      round: 1,
      currentPlayer: 0,
      usedQuestionIds: [42],
      currentQuestion: question(),
      lastAnswer: {
        chosenAnswer: "Lima",
        correct: true,
        correctAnswer: "Lima",
      },
      result: { kind: "tie", scores: [10, 10] },
    });

    const toPlayerTwo = advanceTurn(playerOneTurn);

    expect(toPlayerTwo.phase).toBe("Wheel");
    expect(toPlayerTwo.currentPlayer).toBe(1);
    expect(toPlayerTwo.round).toBe(1);
    expect(toPlayerTwo.currentQuestion).toBeNull();
    expect(toPlayerTwo.lastAnswer).toBeNull();
    expect(toPlayerTwo.result).toBeNull();
    expect(toPlayerTwo.players).toEqual(playerOneTurn.players);
    expect(toPlayerTwo.usedQuestionIds).toEqual([42]);

    const playerTwoTurn = stateWith({
      phase: "SwitchTurn",
      config,
      players: players(10, 0),
      round: 1,
      currentPlayer: 1,
      usedQuestionIds: [42],
      currentQuestion: question(),
      lastAnswer: {
        chosenAnswer: "Lima",
        correct: true,
        correctAnswer: "Lima",
      },
      result: { kind: "tie", scores: [10, 10] },
    });

    const toPlayerOne = advanceTurn(playerTwoTurn);

    expect(toPlayerOne.phase).toBe("Wheel");
    expect(toPlayerOne.currentPlayer).toBe(0);
    expect(toPlayerOne.round).toBe(2);
    expect(toPlayerOne.currentQuestion).toBeNull();
    expect(toPlayerOne.lastAnswer).toBeNull();
    expect(toPlayerOne.result).toBeNull();
    expect(toPlayerOne.players).toEqual(playerTwoTurn.players);
    expect(toPlayerOne.usedQuestionIds).toEqual([42]);
  });

  it("ADVANCE_TURN outside SwitchTurn returns the same state", () => {
    const questionTurn = feedbackState();
    const gameOver = stateWith({ phase: "GameOver", config });

    expect(gameReducer(questionTurn, { type: "ADVANCE_TURN" })).toBe(
      questionTurn,
    );
    expect(gameReducer(gameOver, { type: "ADVANCE_TURN" })).toBe(gameOver);
  });

  it("CATEGORY_CONFIRMED moves from the Wheel to a loading QuestionCard", () => {
    const wheel = stateWith({
      phase: "Wheel",
      config,
      players: players(10, 0),
      round: 1,
      currentPlayer: 1,
      usedQuestionIds: [42],
      lastAnswer: {
        chosenAnswer: "Lima",
        correct: true,
        correctAnswer: "Lima",
      },
      result: { kind: "tie", scores: [10, 0] },
    });

    const next = gameReducer(wheel, { type: "CATEGORY_CONFIRMED" });

    expect(next.phase).toBe("QuestionCard");
    expect(next.currentQuestion).toBeNull();
    expect(next.lastAnswer).toBeNull();
    expect(next.result).toBeNull();
    expect(next.players).toBe(wheel.players);
    expect(next.round).toBe(1);
    expect(next.currentPlayer).toBe(1);
    expect(next.usedQuestionIds).toBe(wheel.usedQuestionIds);
  });

  it("CATEGORY_CONFIRMED outside the Wheel returns the same state", () => {
    const switchTurn = stateWith({ phase: "SwitchTurn", config, round: 1 });
    const gameOver = stateWith({
      phase: "GameOver",
      config,
      result: { kind: "tie", scores: [0, 0] },
    });

    expect(
      gameReducer(INITIAL_GAME_STATE, { type: "CATEGORY_CONFIRMED" }),
    ).toBe(INITIAL_GAME_STATE);
    expect(gameReducer(questionLoaded, { type: "CATEGORY_CONFIRMED" })).toBe(
      questionLoaded,
    );
    expect(gameReducer(switchTurn, { type: "CATEGORY_CONFIRMED" })).toBe(
      switchTurn,
    );
    expect(gameReducer(gameOver, { type: "CATEGORY_CONFIRMED" })).toBe(
      gameOver,
    );
  });

  it("QUESTION_LOADED from the Wheel returns the same state", () => {
    const wheel = stateWith({ phase: "Wheel", config, round: 1 });

    expect(
      gameReducer(wheel, { type: "QUESTION_LOADED", question: question() }),
    ).toBe(wheel);
  });

  it("ANSWER_RECEIVED from the Wheel returns the same state", () => {
    const wheel = stateWith({
      phase: "Wheel",
      config,
      round: 1,
      currentQuestion: question(),
    });

    expect(
      gameReducer(wheel, {
        type: "ANSWER_RECEIVED",
        chosenAnswer: "Lima",
        correct: true,
        correctAnswer: "Lima",
      }),
    ).toBe(wheel);
  });

  it("RESPIN_CATEGORY returns to the Wheel from a failed QuestionCard load", () => {
    const failed = stateWith({
      phase: "QuestionCard",
      config,
      players: players(10, 0),
      round: 1,
      currentPlayer: 1,
      usedQuestionIds: [42],
      currentQuestion: null,
      lastAnswer: {
        chosenAnswer: "Lima",
        correct: true,
        correctAnswer: "Lima",
      },
      result: { kind: "tie", scores: [10, 0] },
    });

    const next = gameReducer(failed, { type: "RESPIN_CATEGORY" });

    expect(next.phase).toBe("Wheel");
    expect(next.currentQuestion).toBeNull();
    expect(next.lastAnswer).toBeNull();
    expect(next.result).toBeNull();
    expect(next.players).toBe(failed.players);
    expect(next.round).toBe(1);
    expect(next.currentPlayer).toBe(1);
    expect(next.usedQuestionIds).toBe(failed.usedQuestionIds);
  });

  it("RESPIN_CATEGORY with a loaded question or outside QuestionCard returns the same state", () => {
    const withQuestion = stateWith({
      phase: "QuestionCard",
      config,
      currentQuestion: question(),
    });
    const switchTurn = stateWith({ phase: "SwitchTurn", config, round: 1 });
    const gameOver = stateWith({
      phase: "GameOver",
      config,
      result: { kind: "tie", scores: [0, 0] },
    });
    const wheel = stateWith({ phase: "Wheel", config, round: 1 });

    expect(gameReducer(withQuestion, { type: "RESPIN_CATEGORY" })).toBe(
      withQuestion,
    );
    expect(gameReducer(INITIAL_GAME_STATE, { type: "RESPIN_CATEGORY" })).toBe(
      INITIAL_GAME_STATE,
    );
    expect(gameReducer(wheel, { type: "RESPIN_CATEGORY" })).toBe(wheel);
    expect(gameReducer(switchTurn, { type: "RESPIN_CATEGORY" })).toBe(
      switchTurn,
    );
    expect(gameReducer(gameOver, { type: "RESPIN_CATEGORY" })).toBe(gameOver);
  });

  it("RESET_GAME returns exactly the initial state", () => {
    const midMatch = feedbackState({ round: 2, currentPlayer: 1 });
    const gameOver = stateWith({
      phase: "GameOver",
      config,
      players: players(30, 10),
      round: 3,
      result: { kind: "winner", winnerIndex: 0, scores: [30, 10] },
    });

    const fromMidMatch = gameReducer(midMatch, { type: "RESET_GAME" });
    const fromGameOver = gameReducer(gameOver, { type: "RESET_GAME" });

    expect(fromMidMatch).toEqual(INITIAL_GAME_STATE);
    expect(fromMidMatch).not.toBe(midMatch);
    expect(fromGameOver).toEqual(INITIAL_GAME_STATE);
  });

  it.each([3, 5, 10] as RoundsCount[])(
    "isMatchComplete is true only on the last answer of the last round (%i rounds)",
    (rounds) => {
      const roundConfig: LobbyConfig = { ...config, rounds };

      expect(
        isMatchComplete(
          stateWith({
            config: roundConfig,
            round: rounds,
            currentPlayer: 0,
          }),
        ),
      ).toBe(false);
      expect(
        isMatchComplete(
          stateWith({
            config: roundConfig,
            round: rounds,
            currentPlayer: 1,
          }),
        ),
      ).toBe(true);
      expect(
        isMatchComplete(
          stateWith({
            config: roundConfig,
            round: rounds - 1,
            currentPlayer: 1,
          }),
        ),
      ).toBe(false);
    },
  );

  it("isMatchComplete is false without a config", () => {
    expect(
      isMatchComplete(stateWith({ config: null, round: 3, currentPlayer: 1 })),
    ).toBe(false);
  });

  it("getCurrentPlayer returns the player at the current index", () => {
    const first = players(10, 20);
    const second = players(30, 40);

    expect(
      getCurrentPlayer(
        stateWith({ players: first, currentPlayer: 0 as PlayerIndex }),
      ),
    ).toBe(first[0]);
    expect(
      getCurrentPlayer(
        stateWith({ players: second, currentPlayer: 1 as PlayerIndex }),
      ),
    ).toBe(second[1]);
  });

  it("no action produces the Result phase and the Wheel is entered only by the three turn actions", () => {
    const states: GameState[] = [
      INITIAL_GAME_STATE,
      started,
      questionLoaded,
      feedbackState(),
      stateWith({
        phase: "QuestionCard",
        config,
        usedQuestionIds: [42],
      }),
      stateWith({ phase: "SwitchTurn", config, round: 1 }),
      stateWith({
        phase: "GameOver",
        config,
        result: { kind: "tie", scores: [0, 0] },
      }),
    ];
    const actions: GameAction[] = [
      { type: "START_GAME", config },
      { type: "CATEGORY_CONFIRMED" },
      { type: "QUESTION_LOADED", question: question() },
      {
        type: "ANSWER_RECEIVED",
        chosenAnswer: "Lima",
        correct: true,
        correctAnswer: "Lima",
      },
      { type: "CONTINUE_AFTER_ANSWER" },
      { type: "ADVANCE_TURN" },
      { type: "RESPIN_CATEGORY" },
      { type: "RESET_GAME" },
    ];
    const wheelActions = new Set([
      "START_GAME",
      "ADVANCE_TURN",
      "RESPIN_CATEGORY",
    ]);

    for (const state of states) {
      for (const action of actions) {
        const next = gameReducer(state, action);
        expect(next.phase).not.toBe("Result");
        if (state.phase !== "Wheel" && next.phase === "Wheel") {
          expect(wheelActions.has(action.type)).toBe(true);
        }
      }
    }

    const failedLoad = stateWith({
      phase: "QuestionCard",
      config,
      usedQuestionIds: [42],
    });
    const switchTurn = stateWith({ phase: "SwitchTurn", config, round: 1 });

    expect(
      gameReducer(INITIAL_GAME_STATE, { type: "START_GAME", config }).phase,
    ).toBe("Wheel");
    expect(gameReducer(switchTurn, { type: "ADVANCE_TURN" }).phase).toBe(
      "Wheel",
    );
    expect(gameReducer(failedLoad, { type: "RESPIN_CATEGORY" }).phase).toBe(
      "Wheel",
    );
    expect(gameReducer(started, { type: "CATEGORY_CONFIRMED" }).phase).toBe(
      "QuestionCard",
    );
    expect(
      gameReducer(questionLoaded, {
        type: "ANSWER_RECEIVED",
        chosenAnswer: "Lima",
        correct: true,
        correctAnswer: "Lima",
      }).phase,
    ).toBe("QuestionCard");
  });

  it("ignores an unknown action", () => {
    // @ts-expect-error exercises the reducer default branch with an unknown action
    const unknownAction: GameAction = { type: "UNKNOWN" };
    expect(gameReducer(started, unknownAction)).toBe(started);
  });

  it("the reducer leaves the input state untouched", () => {
    const frozen = deepFreeze(
      feedbackState({
        phase: "QuestionCard",
        round: 1,
        currentPlayer: 0,
      }),
    );
    const snapshot = JSON.stringify(frozen);

    gameReducer(frozen, {
      type: "QUESTION_LOADED",
      question: question(43),
    });
    gameReducer(frozen, {
      type: "ANSWER_RECEIVED",
      chosenAnswer: "Quito",
      correct: true,
      correctAnswer: "Lima",
    });
    gameReducer(frozen, { type: "CONTINUE_AFTER_ANSWER" });
    gameReducer(frozen, { type: "ADVANCE_TURN" });
    gameReducer(frozen, { type: "CATEGORY_CONFIRMED" });
    gameReducer(frozen, { type: "RESPIN_CATEGORY" });
    gameReducer(frozen, { type: "RESET_GAME" });
    gameReducer(frozen, { type: "START_GAME", config });

    expect(JSON.stringify(frozen)).toBe(snapshot);
  });
});
