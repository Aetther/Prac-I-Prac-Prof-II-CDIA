// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Category } from "../api/types";
import { SIX_CATEGORIES, SIX_WHEEL_CATEGORIES } from "../test/wheelFixtures";
import {
  CATEGORY_EMOJI,
  CATEGORY_NAMES,
  buildWheelCategories,
  findCategoryEmoji,
  findCategoryLabel,
  isCategoryName,
  pickCategoryExcluding,
} from "./category";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("category selection", () => {
  it("declares the six category names in the declared order", () => {
    expect(CATEGORY_NAMES).toEqual([
      "geografia",
      "historia",
      "ciencia",
      "arte",
      "entretenimiento",
      "deportes",
    ]);
  });

  it("skips excluded categories and maps 0 to the first remaining", () => {
    expect(pickCategoryExcluding(["geografia"], () => 0)).toBe("historia");
    const seen = [0, 0.1, 0.5, 0.9, 0.999999, 1].map((value) =>
      pickCategoryExcluding(["geografia"], () => value),
    );
    expect(seen).not.toContain("geografia");
  });

  it("returns null when all six categories are excluded", () => {
    expect(pickCategoryExcluding(CATEGORY_NAMES, () => 0)).toBeNull();
  });

  it("clamps 1 to the last remaining category", () => {
    expect(pickCategoryExcluding(["geografia", "historia"], () => 1)).toBe(
      "deportes",
    );
  });

  it("uses Math.random by default when excluding", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(pickCategoryExcluding(["geografia"])).toBe("historia");
  });

  it("maps across the remaining list, not the full list", () => {
    expect(pickCategoryExcluding(["geografia", "historia"], () => 0.5)).toBe(
      "entretenimiento",
    );
    expect(
      pickCategoryExcluding(["geografia", "historia"], () => 0.5),
    ).not.toBe("arte");
  });
});

describe("category names and labels", () => {
  it("isCategoryName accepts exactly the six declared names", () => {
    for (const name of CATEGORY_NAMES) {
      expect(isCategoryName(name)).toBe(true);
    }
    expect(isCategoryName("otra")).toBe(false);
    expect(isCategoryName("")).toBe(false);
    expect(isCategoryName("Geografía")).toBe(false);
  });

  it("findCategoryLabel returns the API label and falls back to the name", () => {
    expect(findCategoryLabel(SIX_WHEEL_CATEGORIES, "geografia")).toBe(
      "Geografía",
    );
    const withoutArte = SIX_WHEEL_CATEGORIES.filter(
      (category) => category.name !== "arte",
    );
    expect(findCategoryLabel(withoutArte, "arte")).toBe("arte");
    expect(findCategoryLabel([], "geografia")).toBe("geografia");
  });
});

describe("wheel category labels", () => {
  it("builds the wheel categories in declared order from a shuffled API response", () => {
    const reversed = [...SIX_CATEGORIES].reverse();

    expect(buildWheelCategories(reversed)).toEqual([
      { name: "geografia", label: "Geografía" },
      { name: "historia", label: "Historia" },
      { name: "ciencia", label: "Ciencia" },
      { name: "arte", label: "Arte" },
      { name: "entretenimiento", label: "Entretenimiento" },
      { name: "deportes", label: "Deportes" },
    ]);
  });

  it("uses the API label instead of the name and ignores the description", () => {
    const labels = [
      "Etiqueta A",
      "Etiqueta B",
      "Etiqueta C",
      "Etiqueta D",
      "Etiqueta E",
      "Etiqueta F",
    ];
    const categories: Category[] = SIX_CATEGORIES.map((category, index) => ({
      name: category.name,
      label: labels[index],
      description: `d${index + 1}`,
    }));

    const wheel = buildWheelCategories(categories);

    expect(wheel).toEqual([
      { name: "geografia", label: "Etiqueta A" },
      { name: "historia", label: "Etiqueta B" },
      { name: "ciencia", label: "Etiqueta C" },
      { name: "arte", label: "Etiqueta D" },
      { name: "entretenimiento", label: "Etiqueta E" },
      { name: "deportes", label: "Etiqueta F" },
    ]);
    for (const entry of wheel ?? []) {
      expect(entry).not.toHaveProperty("description");
      expect(entry.label).not.toBe(entry.name);
    }
  });

  it("returns null for five entries", () => {
    expect(buildWheelCategories(SIX_CATEGORIES.slice(0, 5))).toBeNull();
  });

  it("returns null when a declared name is missing", () => {
    const withMusica = SIX_CATEGORIES.map((category) =>
      category.name === "deportes" ? { ...category, name: "musica" } : category,
    );
    const duplicateGeografia = SIX_CATEGORIES.map((category) =>
      category.name === "deportes"
        ? { ...category, name: "geografia" }
        : category,
    );

    expect(buildWheelCategories(withMusica)).toBeNull();
    expect(buildWheelCategories(duplicateGeografia)).toBeNull();
  });

  it("returns null for an empty label", () => {
    const emptyLabel = SIX_CATEGORIES.map((category) =>
      category.name === "geografia" ? { ...category, label: "" } : category,
    );

    expect(buildWheelCategories(emptyLabel)).toBeNull();
  });

  it("returns null for seven entries even with all six declared names", () => {
    const seven: Category[] = [
      ...SIX_CATEGORIES,
      { name: "musica", label: "Música", description: "Sonidos" },
    ];

    expect(buildWheelCategories(seven)).toBeNull();
  });

  it("returns the exact six-entry default result", () => {
    expect(buildWheelCategories(SIX_CATEGORIES)).toEqual([
      { name: "geografia", label: "Geografía" },
      { name: "historia", label: "Historia" },
      { name: "ciencia", label: "Ciencia" },
      { name: "arte", label: "Arte" },
      { name: "entretenimiento", label: "Entretenimiento" },
      { name: "deportes", label: "Deportes" },
    ]);
  });

  it("EMOJI-01 CATEGORY_EMOJI maps the six names to their emoji and findCategoryEmoji returns each one", () => {
    expect(CATEGORY_EMOJI).toEqual({
      geografia: "🌎",
      historia: "📜",
      ciencia: "🔬",
      arte: "🎨",
      entretenimiento: "🎬",
      deportes: "⚽",
    });
    expect(Object.isFrozen(CATEGORY_EMOJI)).toBe(true);
    expect(Object.keys(CATEGORY_EMOJI)).toEqual([
      "geografia",
      "historia",
      "ciencia",
      "arte",
      "entretenimiento",
      "deportes",
    ]);
    for (const name of CATEGORY_NAMES) {
      expect(findCategoryEmoji(name)).toBe(CATEGORY_EMOJI[name]);
    }
    expect(findCategoryEmoji("geografia")).not.toBe(
      findCategoryEmoji("deportes"),
    );
  });
});
