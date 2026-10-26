import type { GameQuestion } from "../api/types";
import type {
  GameAction,
  GameResult,
  GameState,
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
};

export interface NextTurn {
  readonly currentPlayer: PlayerIndex;
  readonly round: number;
}

export function getNextTurn(state: GameState): NextTurn {
  return state.currentPlayer === 0
    ? { currentPlayer: 1, round: state.round }
    : { currentPlayer: 0, round: state.round + 1 };
}

export function isMatchComplete(state: GameState): boolean {
  return (
    state.config !== null &&
    state.round === state.config.rounds &&
    state.currentPlayer === 1
  );
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
  action: Extract<GameAction, { type: "ANSWER_RECEIVED" }>,
): GameState {
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
    players: updatedPlayers,
    lastAnswer: {
      chosenAnswer: action.chosenAnswer,
      correct: action.correct,
      correctAnswer: action.correctAnswer,
    },
  };
  if (!isMatchComplete(nextState)) {
    return nextState;
  }
  return { ...nextState, result: computeGameResult(updatedPlayers) };
}

function withAnswerContinued(state: GameState): GameState {
  return {
    ...state,
    phase: state.result !== null ? "GameOver" : "SwitchTurn",
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
      return withAnswerReceived(state, action);
    case "CONTINUE_AFTER_ANSWER":
      if (state.phase !== "QuestionCard" || state.lastAnswer === null) {
        return state;
      }
      return withAnswerContinued(state);
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
