import type { WheelCategory } from "../game/category";
import type { CategoryName } from "../game/types";
import type { Language } from "./language";

export const ENGLISH_CATEGORY_LABELS: Readonly<Record<CategoryName, string>> = {
  geografia: "Geography",
  historia: "History",
  ciencia: "Science",
  arte: "Art",
  entretenimiento: "Entertainment",
  deportes: "Sports",
};

/** In English, replaces each label and keeps the name the API expects. */
export function localizeCategories(
  categories: readonly WheelCategory[],
  language: Language,
): readonly WheelCategory[] {
  if (language === "es") return categories;
  return categories.map((category) => ({
    name: category.name,
    label: ENGLISH_CATEGORY_LABELS[category.name],
  }));
}
