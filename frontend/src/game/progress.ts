import type {
  CategoryHits,
  CategoryOwners,
  GameState,
  LobbyConfig,
  RoundsCount,
  TurnsPlayed,
} from "./types";

export interface RoundsProgress {
  readonly mode: "rounds";
  readonly round: number;
  readonly totalRounds: RoundsCount;
}

export interface SixCategoriesProgress {
  readonly mode: "six-categories";
  readonly ownedCategories: CategoryOwners;
  readonly turnsPlayed: TurnsPlayed;
  /** Correct answers per category; missing counts owned ones as full. */
  readonly categoryHits?: CategoryHits;
}

export type MatchProgress = RoundsProgress | SixCategoriesProgress;

export function getMatchProgress(
  config: LobbyConfig,
  state: Pick<GameState, "round" | "ownedCategories" | "turnsPlayed"> &
    Partial<Pick<GameState, "categoryHits">>,
): MatchProgress {
  if (config.mode === "six-categories") {
    return {
      mode: "six-categories",
      ownedCategories: state.ownedCategories,
      turnsPlayed: state.turnsPlayed,
      ...(state.categoryHits === undefined
        ? {}
        : { categoryHits: state.categoryHits }),
    };
  }
  return {
    mode: "rounds",
    round: state.round,
    totalRounds: config.rounds,
  };
}
