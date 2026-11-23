import { CATEGORY_NAMES, isCategoryName } from "./category";
import type {
  CategoryHits,
  CategoryName,
  CategoryOwners,
  CategoryTally,
  CrownStep,
  GameResult,
  PlayerIndex,
  SixCategoriesGameResult,
  TurnsPlayed,
} from "./types";

/** Turns each player may lose before the crowns match ends. */
export const TURN_LIMIT = 30;
export const CATEGORIES_TO_WIN = 6;
/** Correct answers in one category that win its crown. */
export const HITS_PER_CROWN = 3;

export interface SixCategoriesAnswerInput {
  readonly ownedCategories: CategoryOwners;
  /** Missing means no correct answer yet in any category. */
  readonly categoryHits?: CategoryHits;
  readonly turnsPlayed: TurnsPlayed;
  readonly currentPlayer: PlayerIndex;
  readonly category: string;
  readonly correct: boolean;
}

export interface SixCategoriesAnswerOutcome {
  readonly ownedCategories: CategoryOwners;
  readonly categoryHits: CategoryHits;
  readonly turnsPlayed: TurnsPlayed;
  readonly keepsTurn: boolean;
  readonly result: SixCategoriesGameResult | null;
  /** The progress of a correct answer on a category without its crown. */
  readonly step: CrownStep | null;
}

export const NO_HITS: CategoryHits = [{}, {}];

/**
 * A player's correct answers in a category. An owned category always counts
 * as a full crown, whatever the tally says.
 */
export function hitsIn(
  owned: readonly CategoryName[],
  tally: CategoryTally,
  category: CategoryName,
): number {
  if (owned.includes(category)) return HITS_PER_CROWN;
  return Math.min(HITS_PER_CROWN, tally[category] ?? 0);
}

/** All the correct answers that count towards a player's crowns. */
export function totalHits(
  owned: readonly CategoryName[],
  tally: CategoryTally,
): number {
  return CATEGORY_NAMES.reduce(
    (sum, category) => sum + hitsIn(owned, tally, category),
    0,
  );
}

export function isTurnLimitReached(turnsPlayed: TurnsPlayed): boolean {
  return turnsPlayed[0] === TURN_LIMIT && turnsPlayed[1] === TURN_LIMIT;
}

export function isSixCategoriesResult(
  result: GameResult,
): result is SixCategoriesGameResult {
  return "mode" in result && result.mode === "six-categories";
}

function crownCounts(categories: CategoryOwners): readonly [number, number] {
  return [categories[0].length, categories[1].length];
}

export function computeCategoryWin(
  categories: CategoryOwners,
  winnerIndex: PlayerIndex,
): SixCategoriesGameResult {
  return {
    mode: "six-categories",
    kind: "winner",
    winnerIndex,
    categories: crownCounts(categories),
    reason: "six-categories",
  };
}

/**
 * At the turn limit the most crowns win; equal crowns are decided by the
 * accumulated correct answers, and only then is the match a tie.
 */
export function computeTurnLimitResult(
  categories: CategoryOwners,
  categoryHits: CategoryHits = NO_HITS,
): SixCategoriesGameResult {
  const counts = crownCounts(categories);
  if (counts[0] !== counts[1]) {
    return {
      mode: "six-categories",
      kind: "winner",
      winnerIndex: counts[0] > counts[1] ? 0 : 1,
      categories: counts,
      reason: "turn-limit",
    };
  }
  const hits: readonly [number, number] = [
    totalHits(categories[0], categoryHits[0]),
    totalHits(categories[1], categoryHits[1]),
  ];
  if (hits[0] === hits[1]) {
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
    winnerIndex: hits[0] > hits[1] ? 0 : 1,
    categories: counts,
    reason: "turn-limit",
    hits,
  };
}

function nextTurnsPlayed(input: SixCategoriesAnswerInput): TurnsPlayed {
  if (input.correct) return input.turnsPlayed;
  return input.currentPlayer === 0
    ? [input.turnsPlayed[0] + 1, input.turnsPlayed[1]]
    : [input.turnsPlayed[0], input.turnsPlayed[1] + 1];
}

interface Progress {
  readonly ownedCategories: CategoryOwners;
  readonly categoryHits: CategoryHits;
  readonly step: CrownStep | null;
}

function nextProgress(input: SixCategoriesAnswerInput): Progress {
  const categoryHits = input.categoryHits ?? NO_HITS;
  const unchanged = {
    ownedCategories: input.ownedCategories,
    categoryHits,
    step: null,
  };
  if (!input.correct || !isCategoryName(input.category)) return unchanged;

  const served: CategoryName = input.category;
  const player = input.currentPlayer;
  const owned = input.ownedCategories[player];
  const tally = categoryHits[player];
  const before = hitsIn(owned, tally, served);
  if (before >= HITS_PER_CROWN) return unchanged;

  const hits = before + 1;
  const crowned = hits === HITS_PER_CROWN;
  const nextTally: CategoryTally = { ...tally, [served]: hits };
  const nextOwned = crowned ? [...owned, served] : owned;
  return {
    ownedCategories:
      player === 0
        ? [nextOwned, input.ownedCategories[1]]
        : [input.ownedCategories[0], nextOwned],
    categoryHits:
      player === 0
        ? [nextTally, categoryHits[1]]
        : [categoryHits[0], nextTally],
    step: { category: served, hits, crowned },
  };
}

export function applySixCategoriesAnswer(
  input: SixCategoriesAnswerInput,
): SixCategoriesAnswerOutcome {
  const progress = nextProgress(input);
  const turnsPlayed = nextTurnsPlayed(input);

  let result: SixCategoriesGameResult | null = null;
  if (
    input.correct &&
    progress.ownedCategories[input.currentPlayer].length === CATEGORIES_TO_WIN
  ) {
    result = computeCategoryWin(progress.ownedCategories, input.currentPlayer);
  } else if (!input.correct && isTurnLimitReached(turnsPlayed)) {
    result = computeTurnLimitResult(
      progress.ownedCategories,
      progress.categoryHits,
    );
  }

  return {
    ownedCategories: progress.ownedCategories,
    categoryHits: progress.categoryHits,
    turnsPlayed,
    keepsTurn: input.correct,
    result,
    step: progress.step,
  };
}
