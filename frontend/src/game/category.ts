import type { Category } from "../api/types";
import type { CategoryName } from "./types";

export const CATEGORY_NAMES: readonly CategoryName[] = [
  "geografia",
  "historia",
  "ciencia",
  "arte",
  "entretenimiento",
  "deportes",
];

export interface WheelCategory {
  readonly name: CategoryName;
  readonly label: string;
}

function clampIndex(randomValue: number, length: number): number {
  return Math.min(Math.max(Math.floor(randomValue * length), 0), length - 1);
}

export function buildWheelCategories(
  categories: readonly Category[],
): WheelCategory[] | null {
  if (categories.length !== CATEGORY_NAMES.length) return null;

  const byName = new Map<string, Category>();
  for (const category of categories) {
    byName.set(category.name, category);
  }
  if (byName.size !== CATEGORY_NAMES.length) return null;

  const wheel: WheelCategory[] = [];
  for (const name of CATEGORY_NAMES) {
    const category = byName.get(name);
    if (category === undefined || category.label === "") return null;
    wheel.push({ name, label: category.label });
  }
  return wheel;
}

export function pickCategoryExcluding(
  excluded: readonly CategoryName[],
  random: () => number = Math.random,
): CategoryName | null {
  const remaining = CATEGORY_NAMES.filter((name) => !excluded.includes(name));
  if (remaining.length === 0) return null;
  return remaining[clampIndex(random(), remaining.length)];
}
