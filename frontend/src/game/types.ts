import type { GameQuestion } from "../api/types";

export type GamePhase =
  "Lobby" | "Wheel" | "QuestionCard" | "Result" | "SwitchTurn" | "GameOver";

export type Lang = "es" | "en";
export type SecondsPerQuestion = 10 | 20 | 30;
export type RoundsCount = 3 | 5 | 10;
export type GameMode = "rounds";
export type PlayerIndex = 0 | 1;
export type CategoryName =
  | "geografia"
  | "historia"
  | "ciencia"
  | "arte"
  | "entretenimiento"
  | "deportes";

export interface LobbyConfig {
  readonly playerNames: readonly [string, string];
  readonly lang: Lang;
  readonly secondsPerQuestion: SecondsPerQuestion;
  readonly mode: GameMode;
  readonly rounds: RoundsCount;
}

export interface Player {
  readonly name: string;
  readonly score: number;
}

export interface LastAnswer {
  readonly chosenAnswer: string;
  readonly correct: boolean;
  readonly correctAnswer: string;
}

export type GameResult =
  | {
      readonly kind: "winner";
      readonly winnerIndex: PlayerIndex;
      readonly scores: readonly [number, number];
    }
  | {
      readonly kind: "tie";
      readonly scores: readonly [number, number];
    };

export interface GameState {
  readonly phase: GamePhase;
  readonly config: LobbyConfig | null;
  readonly players: readonly [Player, Player];
  readonly round: number;
  readonly currentPlayer: PlayerIndex;
  readonly usedQuestionIds: readonly number[];
  readonly currentQuestion: GameQuestion | null;
  readonly lastAnswer: LastAnswer | null;
  readonly result: GameResult | null;
}

export type GameAction =
  | { readonly type: "START_GAME"; readonly config: LobbyConfig }
  | { readonly type: "QUESTION_LOADED"; readonly question: GameQuestion }
  | {
      readonly type: "ANSWER_RECEIVED";
      readonly chosenAnswer: string;
      readonly correct: boolean;
      readonly correctAnswer: string;
    }
  | { readonly type: "CONTINUE_AFTER_ANSWER" }
  | { readonly type: "ADVANCE_TURN" }
  | { readonly type: "RESET_GAME" };
