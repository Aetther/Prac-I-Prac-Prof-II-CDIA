import type { CSSProperties } from "react";
import {
  CATEGORY_NAMES,
  findCategoryEmoji,
  findCategoryLabel,
} from "../game/category";
import type { WheelCategory } from "../game/category";
import { HITS_PER_CROWN, hitsIn } from "../game/sixCategories";
import type { CategoryName, CategoryTally } from "../game/types";
import { useMessages } from "../i18n";
import { CATEGORY_COLOR_TOKENS } from "./categoryColors";

interface CrownProgressProps {
  playerName: string;
  categories: readonly WheelCategory[];
  owned: readonly CategoryName[];
  /** Missing means only the owned crowns are known. */
  hits?: CategoryTally;
}

/**
 * One ring per category that fills by thirds with the player's correct
 * answers and shows a crown once the category is won.
 */
export function CrownProgress({
  playerName,
  categories,
  owned,
  hits = {},
}: CrownProgressProps) {
  const m = useMessages();
  return (
    <ul
      className="crown-progress"
      aria-label={m.categoriesOfPlayer(playerName)}
    >
      {CATEGORY_NAMES.map((name) => {
        const count = hitsIn(owned, hits, name);
        const won = count >= HITS_PER_CROWN;
        const style = {
          "--ring-color": CATEGORY_COLOR_TOKENS[name],
          "--ring-fill": `${(count / HITS_PER_CROWN) * 100}%`,
        } as CSSProperties;
        return (
          <li
            key={name}
            className={won ? "crown-ring crown-ring-won" : "crown-ring"}
            data-category={name}
            data-hits={count}
            style={style}
          >
            <span className="crown-ring-emoji" aria-hidden="true">
              {won ? "👑" : findCategoryEmoji(name)}
            </span>
            <span className="crown-ring-count" aria-hidden="true">
              {count}/{HITS_PER_CROWN}
            </span>
            <span className="visually-hidden">
              {m.crownRing(findCategoryLabel(categories, name), count)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
