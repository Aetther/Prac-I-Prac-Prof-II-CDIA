import type { CategoryName } from "../game/types";

/** Each category's colour token, for inline styles such as the crown rings. */
export const CATEGORY_COLOR_TOKENS: Readonly<Record<CategoryName, string>> = {
  geografia: "var(--color-category-geografia)",
  historia: "var(--color-category-historia)",
  ciencia: "var(--color-category-ciencia)",
  arte: "var(--color-category-arte)",
  entretenimiento: "var(--color-category-entretenimiento)",
  deportes: "var(--color-category-deportes)",
};
