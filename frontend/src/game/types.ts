import type { GameQuestion } from "../api/types";

export type GamePhase =
  "Lobby" | "Wheel" | "QuestionCard" | "Result" | "SwitchTurn" | "GameOver";

export type Lang = "es" | "en";
export type SecondsPerQuestion = 10 | 20 | 30;
export type RoundsCount = 3 | 5 | 10;
export type GameMode = "rounds" | "six-categories";
export type PlayerIndex = 0 | 1;
export type CategoryName =
  | "geografia"
  | "historia"
  | "ciencia"
  | "arte"
  | "entretenimiento"
  | "deportes";

interface LobbyConfigBase {
  readonly playerNames: readonly [string, string];
  readonly lang: Lang;
  readonly secondsPerQuestion: SecondsPerQuestion;
}

export interface RoundsLobbyConfig extends LobbyConfigBase {
  readonly mode: "rounds";
  readonly rounds: RoundsCount;
}

export interface SixCategoriesLobbyConfig extends LobbyConfigBase {
  readonly mode: "six-categories";
}

export type LobbyConfig = RoundsLobbyConfig | SixCategoriesLobbyConfig;

export type CategoryOwners = readonly [
  readonly CategoryName[],
  readonly CategoryName[],
];

export type TurnsPlayed = readonly [number, number];

export interface Player {
  readonly name: string;
  readonly score: number;
}

export interface LastAnswer {
  readonly chosenAnswer: string | null;
  readonly correct: boolean;
  readonly correctAnswer: string;
  readonly timedOut: boolean;
}

export type RoundsGameResult =
  | {
      readonly kind: "winner";
      readonly winnerIndex: PlayerIndex;
      readonly scores: readonly [number, number];
      /** Set when the match ended because this player surrendered. */
      readonly surrenderedBy?: PlayerIndex;
    }
  | {
      readonly kind: "tie";
      readonly scores: readonly [number, number];
    };

export type SixCategoriesGameResult =
  | {
      readonly mode: "six-categories";
      readonly kind: "winner";
      readonly winnerIndex: PlayerIndex;
      readonly categories: readonly [number, number];
      readonly reason: "six-categories" | "turn-limit" | "surrender";
      /** Set when the match ended because this player surrendered. */
      readonly surrenderedBy?: PlayerIndex;
    }
  | {
      readonly mode: "six-categories";
      readonly kind: "tie";
      readonly categories: readonly [number, number];
      readonly reason: "turn-limit";
    };

export type GameResult = RoundsGameResult | SixCategoriesGameResult;

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
  readonly ownedCategories: CategoryOwners;
  readonly turnsPlayed: TurnsPlayed;
  readonly matchId: number;
  readonly reportedQuestionIds: readonly number[];
}

export type GameAction =
  | { readonly type: "START_GAME"; readonly config: LobbyConfig }
  | { readonly type: "CATEGORY_CONFIRMED" }
  | { readonly type: "QUESTION_LOADED"; readonly question: GameQuestion }
  | {
      readonly type: "ANSWER_RECEIVED";
      readonly chosenAnswer: string | null;
      readonly correct: boolean;
      readonly correctAnswer: string;
      readonly timedOut: boolean;
    }
  | { readonly type: "CONTINUE_AFTER_ANSWER" }
  | { readonly type: "ADVANCE_TURN" }
  | { readonly type: "RESPIN_CATEGORY" }
  | { readonly type: "RESET_GAME" }
  | { readonly type: "SURRENDER" }
  | {
      readonly type: "QUESTION_REPORTED";
      readonly questionId: number;
      readonly matchId: number;
    };
