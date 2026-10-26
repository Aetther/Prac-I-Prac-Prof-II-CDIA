import type {
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
}

export type MatchProgress = RoundsProgress | SixCategoriesProgress;

export function getMatchProgress(
  config: LobbyConfig,
  state: Pick<GameState, "round" | "ownedCategories" | "turnsPlayed">,
): MatchProgress {
  if (config.mode === "six-categories") {
    return {
      mode: "six-categories",
      ownedCategories: state.ownedCategories,
      turnsPlayed: state.turnsPlayed,
    };
  }
  return {
    mode: "rounds",
    round: state.round,
    totalRounds: config.rounds,
  };
}
