import { isCategoryName } from "./category";
import type {
  CategoryName,
  CategoryOwners,
  GameResult,
  PlayerIndex,
  SixCategoriesGameResult,
  TurnsPlayed,
} from "./types";

export const TURN_LIMIT = 20;
export const CATEGORIES_TO_WIN = 6;

export interface SixCategoriesAnswerInput {
  readonly ownedCategories: CategoryOwners;
  readonly turnsPlayed: TurnsPlayed;
  readonly currentPlayer: PlayerIndex;
  readonly category: string;
  readonly correct: boolean;
}

export interface SixCategoriesAnswerOutcome {
  readonly ownedCategories: CategoryOwners;
  readonly turnsPlayed: TurnsPlayed;
  readonly keepsTurn: boolean;
  readonly result: SixCategoriesGameResult | null;
}

export function isTurnLimitReached(turnsPlayed: TurnsPlayed): boolean {
  return turnsPlayed[0] === TURN_LIMIT && turnsPlayed[1] === TURN_LIMIT;
}

export function isSixCategoriesResult(
  result: GameResult,
): result is SixCategoriesGameResult {
  return "mode" in result && result.mode === "six-categories";
}

export function computeCategoryWin(
  categories: CategoryOwners,
  winnerIndex: PlayerIndex,
): SixCategoriesGameResult {
  const counts: readonly [number, number] = [
    categories[0].length,
    categories[1].length,
  ];
  return {
    mode: "six-categories",
    kind: "winner",
    winnerIndex,
    categories: counts,
    reason: "six-categories",
  };
}

export function computeTurnLimitResult(
  categories: CategoryOwners,
): SixCategoriesGameResult {
  const counts: readonly [number, number] = [
    categories[0].length,
    categories[1].length,
  ];
  if (counts[0] === counts[1]) {
    return {
      mode: "six-categories",
      kind: "tie",
      categories: counts,
      reason: "turn-limit",
    };
  }
  return {
    mode: "six-categories",
    kind: "winner",
    winnerIndex: counts[0] > counts[1] ? 0 : 1,
    categories: counts,
    reason: "turn-limit",
  };
}

function nextTurnsPlayed(input: SixCategoriesAnswerInput): TurnsPlayed {
  if (input.correct) return input.turnsPlayed;
  return input.currentPlayer === 0
    ? [input.turnsPlayed[0] + 1, input.turnsPlayed[1]]
    : [input.turnsPlayed[0], input.turnsPlayed[1] + 1];
}

function nextOwnedCategories(input: SixCategoriesAnswerInput): CategoryOwners {
  if (!input.correct || !isCategoryName(input.category)) {
    return input.ownedCategories;
  }
  const served: CategoryName = input.category;
  const owned = input.ownedCategories[input.currentPlayer];
  if (owned.includes(served)) return input.ownedCategories;

  const updated = [...owned, served];
  return input.currentPlayer === 0
    ? [updated, input.ownedCategories[1]]
    : [input.ownedCategories[0], updated];
}

export function applySixCategoriesAnswer(
  input: SixCategoriesAnswerInput,
): SixCategoriesAnswerOutcome {
  const ownedCategories = nextOwnedCategories(input);
  const turnsPlayed = nextTurnsPlayed(input);

  let result: SixCategoriesGameResult | null = null;
  if (
    input.correct &&
    ownedCategories[input.currentPlayer].length === CATEGORIES_TO_WIN
  ) {
    result = computeCategoryWin(ownedCategories, input.currentPlayer);
  } else if (!input.correct && isTurnLimitReached(turnsPlayed)) {
    result = computeTurnLimitResult(ownedCategories);
  }

  return {
    ownedCategories,
    turnsPlayed,
    keepsTurn: input.correct,
    result,
  };
}
