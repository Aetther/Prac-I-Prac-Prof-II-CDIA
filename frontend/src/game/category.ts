import type { CategoryName } from "./types";

export const CATEGORY_NAMES: readonly CategoryName[] = [
  "geografia",
  "historia",
  "ciencia",
  "arte",
  "entretenimiento",
  "deportes",
];

function clampIndex(randomValue: number, length: number): number {
  return Math.min(Math.max(Math.floor(randomValue * length), 0), length - 1);
}

export function pickRandomCategory(
  random: () => number = Math.random,
): CategoryName {
  return CATEGORY_NAMES[clampIndex(random(), CATEGORY_NAMES.length)];
}

export function pickCategoryExcluding(
  excluded: readonly CategoryName[],
  random: () => number = Math.random,
): CategoryName | null {
  const remaining = CATEGORY_NAMES.filter((name) => !excluded.includes(name));
  if (remaining.length === 0) return null;
  return remaining[clampIndex(random(), remaining.length)];
}
