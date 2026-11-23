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

/** Correct answers a player has in each category in the crowns mode. */
export type CategoryTally = Readonly<Partial<Record<CategoryName, number>>>;
export type CategoryHits = readonly [CategoryTally, CategoryTally];

/** What a correct crowns-mode answer did to its category. */
export interface CrownStep {
  readonly category: CategoryName;
  /** Correct answers in the category after this one, 1 to 3. */
  readonly hits: number;
  /** True when this answer completed the category's crown. */
  readonly crowned: boolean;
}

export interface Player {
  readonly name: string;
  readonly score: number;
}

export interface LastAnswer {
  readonly chosenAnswer: string | null;
  readonly correct: boolean;
  readonly correctAnswer: string;
  readonly timedOut: boolean;
  /** Crowns mode only: the progress a correct answer made. */
  readonly crownStep?: CrownStep;
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
      /**
       * Set when the turn limit found equal crowns and the accumulated
       * correct answers decided the winner.
       */
      readonly hits?: readonly [number, number];
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
  readonly categoryHits: CategoryHits;
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
