import type { CategoryName } from "../game/types";

export interface WheelPalette {
  readonly sector: Readonly<Record<CategoryName, string>>;
  /** The darker variant of each sector, used for the halo around its label. */
  readonly deep: Readonly<Record<CategoryName, string>>;
  readonly pointer: string;
  readonly label: string;
  readonly stroke: string;
}

export function readWheelPalette(
  style: Pick<CSSStyleDeclaration, "getPropertyValue">,
): WheelPalette {
  const read = (token: string): string => style.getPropertyValue(token).trim();

  return {
    sector: {
      geografia: read("--color-category-geografia"),
      historia: read("--color-category-historia"),
      ciencia: read("--color-category-ciencia"),
      arte: read("--color-category-arte"),
      entretenimiento: read("--color-category-entretenimiento"),
      deportes: read("--color-category-deportes"),
    },
    deep: {
      geografia: read("--color-category-geografia-deep"),
      historia: read("--color-category-historia-deep"),
      ciencia: read("--color-category-ciencia-deep"),
      arte: read("--color-category-arte-deep"),
      entretenimiento: read("--color-category-entretenimiento-deep"),
      deportes: read("--color-category-deportes-deep"),
    },
    pointer: read("--color-wheel-pointer"),
    label: read("--color-wheel-label"),
    stroke: read("--color-wheel-stroke"),
  };
}
