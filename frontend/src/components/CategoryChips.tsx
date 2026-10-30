import { findCategoryEmoji, findCategoryLabel } from "../game/category";
import type { WheelCategory } from "../game/category";
import type { CategoryName } from "../game/types";
import { useMessages } from "../i18n";

// The map is static data, so exporting it next to the component is safe.
// eslint-disable-next-line react-refresh/only-export-components
export const CATEGORY_COLOR_TOKENS: Readonly<Record<CategoryName, string>> = {
  geografia: "var(--color-category-geografia)",
  historia: "var(--color-category-historia)",
  ciencia: "var(--color-category-ciencia)",
  arte: "var(--color-category-arte)",
  entretenimiento: "var(--color-category-entretenimiento)",
  deportes: "var(--color-category-deportes)",
};

interface CategoryChipsProps {
  playerName: string;
  categories: readonly WheelCategory[];
  owned: readonly CategoryName[];
}

export function CategoryChips({
  playerName,
  categories,
  owned,
}: CategoryChipsProps) {
  const m = useMessages();
  if (owned.length === 0) {
    return <p>{m.noCategories}</p>;
  }
  return (
    <ul
      className="category-chips"
      aria-label={m.categoriesOfPlayer(playerName)}
    >
      {owned.map((name) => (
        <li
          key={name}
          className="category-chip"
          data-category={name}
          style={{ backgroundColor: CATEGORY_COLOR_TOKENS[name] }}
        >
          <span className="category-chip-emoji" aria-hidden="true">
            {findCategoryEmoji(name)}
          </span>
          <span className="category-chip-label">
            {findCategoryLabel(categories, name)}
          </span>
        </li>
      ))}
    </ul>
  );
}
