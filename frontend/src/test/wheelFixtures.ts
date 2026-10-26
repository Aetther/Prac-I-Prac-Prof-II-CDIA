import type { Category } from "../api/types";
import { CATEGORY_NAMES } from "../game/category";
import type { WheelCategory } from "../game/category";
import type { WheelTick } from "../game/wheel";
import type { CategoryName } from "../game/types";

export const SIX_CATEGORIES: Category[] = [
  {
    name: "geografia",
    label: "Geografía",
    description: "Mapas y lugares",
  },
  {
    name: "historia",
    label: "Historia",
    description: "Hechos y épocas",
  },
  {
    name: "ciencia",
    label: "Ciencia",
    description: "Naturaleza y descubrimientos",
  },
  {
    name: "arte",
    label: "Arte",
    description: "Obras y artistas",
  },
  {
    name: "entretenimiento",
    label: "Entretenimiento",
    description: "Cultura popular",
  },
  {
    name: "deportes",
    label: "Deportes",
    description: "Competencias",
  },
];

export const SIX_WHEEL_CATEGORIES: WheelCategory[] = SIX_CATEGORIES.map(
  ({ name, label }) => ({ name: name as CategoryName, label }),
);

export const EXPECTED_24_TICKS: WheelTick[] = Array.from({ length: 4 }, () => [
  5, 4, 3, 2, 1, 0,
])
  .flat()
  .map((sectorIndex) => ({
    sectorIndex,
    category: CATEGORY_NAMES[sectorIndex],
  }));

export const FRAME_TIMESTAMPS = [
  0, 250, 500, 750, 1000, 1250, 1500, 1750, 2000, 2250, 2500, 2750, 3000, 3250,
  3500, 3750, 4000,
];

export const SENTINEL_TOKENS: Readonly<Record<string, string>> = {
  "--color-category-geografia": "sentinel-geografia",
  "--color-category-historia": "sentinel-historia",
  "--color-category-ciencia": "sentinel-ciencia",
  "--color-category-arte": "sentinel-arte",
  "--color-category-entretenimiento": "sentinel-entretenimiento",
  "--color-category-deportes": "sentinel-deportes",
  "--color-wheel-pointer": "sentinel-pointer",
  "--color-wheel-label": "sentinel-label",
  "--color-wheel-hub": "sentinel-hub",
  "--color-wheel-stroke": "sentinel-stroke",
  "--font-family-sans": "sentinel-font",
};
