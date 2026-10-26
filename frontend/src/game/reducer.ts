import type { GameQuestion } from "../api/types";
import { applySixCategoriesAnswer } from "./sixCategories";
import type {
  GameAction,
  GameResult,
  GameState,
  LastAnswer,
  LobbyConfig,
  Player,
  PlayerIndex,
} from "./types";

export const INITIAL_GAME_STATE: GameState = {
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
  ownedCategories: [[], []],
  turnsPlayed: [0, 0],
};

export interface NextTurn {
  readonly currentPlayer: PlayerIndex;
  readonly round: number;
}

export function getNextTurn(state: GameState): NextTurn {
  const keepRound =
    state.config !== null && state.config.mode === "six-categories";
  return state.currentPlayer === 0
    ? { currentPlayer: 1, round: state.round }
    : { currentPlayer: 0, round: keepRound ? state.round : state.round + 1 };
}

export function isMatchComplete(state: GameState): boolean {
  if (state.config === null) return false;
  if (state.config.mode === "six-categories") return false;
  return state.round === state.config.rounds && state.currentPlayer === 1;
}

export function computeGameResult(
  players: readonly [Player, Player],
): GameResult {
  const [first, second] = players;
  const scores: readonly [number, number] = [first.score, second.score];
  if (first.score === second.score) {
    return { kind: "tie", scores };
  }
  return {
    kind: "winner",
    winnerIndex: first.score > second.score ? 0 : 1,
    scores,
  };
}

export function getCurrentPlayer(state: GameState): Player {
  return state.players[state.currentPlayer];
}

export function advanceTurn(state: GameState): GameState {
  const next = getNextTurn(state);
  return {
    ...state,
    phase: "Wheel",
    currentPlayer: next.currentPlayer,
    round: next.round,
    currentQuestion: null,
    lastAnswer: null,
    result: null,
  };
}

function withQuestionLoaded(
  state: GameState,
  question: GameQuestion,
): GameState {
  return {
    ...state,
    currentQuestion: question,
    usedQuestionIds: [...state.usedQuestionIds, question.id],
    lastAnswer: null,
  };
}

function withAnswerReceived(
  state: GameState,
  config: LobbyConfig,
  question: GameQuestion,
  action: Extract<GameAction, { type: "ANSWER_RECEIVED" }>,
): GameState {
  if (config.mode === "six-categories") {
    const outcome = applySixCategoriesAnswer({
      ownedCategories: state.ownedCategories,
      turnsPlayed: state.turnsPlayed,
      currentPlayer: state.currentPlayer,
      category: question.category,
      correct: action.correct,
    });
    return {
      ...state,
      phase: "Result",
      ownedCategories: outcome.ownedCategories,
      turnsPlayed: outcome.turnsPlayed,
      result: outcome.result,
      lastAnswer: {
        chosenAnswer: action.chosenAnswer,
        correct: action.correct,
        correctAnswer: action.correctAnswer,
        timedOut: action.timedOut,
      },
    };
  }

  const updatedPlayers: readonly [Player, Player] = [
    state.currentPlayer === 0 && action.correct
      ? { ...state.players[0], score: state.players[0].score + 10 }
      : state.players[0],
    state.currentPlayer === 1 && action.correct
      ? { ...state.players[1], score: state.players[1].score + 10 }
      : state.players[1],
  ];
  const nextState: GameState = {
    ...state,
    phase: "Result",
    players: updatedPlayers,
    lastAnswer: {
      chosenAnswer: action.chosenAnswer,
      correct: action.correct,
      correctAnswer: action.correctAnswer,
      timedOut: action.timedOut,
    },
  };
  if (!isMatchComplete(nextState)) {
    return nextState;
  }
  return { ...nextState, result: computeGameResult(updatedPlayers) };
}

function withAnswerContinued(
  state: GameState,
  lastAnswer: LastAnswer,
): GameState {
  const keepsTurn =
    state.config !== null &&
    state.config.mode === "six-categories" &&
    lastAnswer.correct;
  return {
    ...state,
    phase:
      state.result !== null ? "GameOver" : keepsTurn ? "Wheel" : "SwitchTurn",
    lastAnswer: null,
    currentQuestion: null,
  };
}

function withCategoryConfirmed(state: GameState): GameState {
  return {
    ...state,
    phase: "QuestionCard",
    currentQuestion: null,
    lastAnswer: null,
    result: null,
  };
}

function withRespinCategory(state: GameState): GameState {
  return {
    ...state,
    phase: "Wheel",
    lastAnswer: null,
    result: null,
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "START_GAME":
      if (state.phase !== "Lobby") return state;
      return {
        phase: "Wheel",
        config: action.config,
        players: [
          { name: action.config.playerNames[0], score: 0 },
          { name: action.config.playerNames[1], score: 0 },
        ],
        round: 1,
        currentPlayer: 0,
        usedQuestionIds: [],
        currentQuestion: null,
        lastAnswer: null,
        result: null,
        ownedCategories: [[], []],
        turnsPlayed: [0, 0],
      };
    case "CATEGORY_CONFIRMED":
      if (state.phase !== "Wheel") return state;
      return withCategoryConfirmed(state);
    case "QUESTION_LOADED":
      if (state.phase !== "QuestionCard") return state;
      return withQuestionLoaded(state, action.question);
    case "ANSWER_RECEIVED":
      if (
        state.phase !== "QuestionCard" ||
        state.config === null ||
        state.currentQuestion === null ||
        state.lastAnswer !== null
      ) {
        return state;
      }
      return withAnswerReceived(
        state,
        state.config,
        state.currentQuestion,
        action,
      );
    case "CONTINUE_AFTER_ANSWER":
      if (state.phase !== "Result" || state.lastAnswer === null) {
        return state;
      }
      return withAnswerContinued(state, state.lastAnswer);
    case "ADVANCE_TURN":
      if (state.phase !== "SwitchTurn") return state;
      return advanceTurn(state);
    case "RESPIN_CATEGORY":
      if (state.phase !== "QuestionCard" || state.currentQuestion !== null) {
        return state;
      }
      return withRespinCategory(state);
    case "RESET_GAME":
      return INITIAL_GAME_STATE;
    default:
      return state;
  }
}
