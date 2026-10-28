import type { CategoryName } from "../game/types";

export interface WheelPalette {
  readonly sector: Readonly<Record<CategoryName, string>>;
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
    pointer: read("--color-wheel-pointer"),
    label: read("--color-wheel-label"),
    stroke: read("--color-wheel-stroke"),
  };
}
