// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CATEGORY_NAMES,
  pickCategoryExcluding,
  pickRandomCategory,
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

  it("maps 0 to geografia", () => {
    expect(pickRandomCategory(() => 0)).toBe("geografia");
  });

  it("maps 0.5 to arte", () => {
    expect(pickRandomCategory(() => 0.5)).toBe("arte");
  });

  it("maps 0.999999 to deportes", () => {
    expect(pickRandomCategory(() => 0.999999)).toBe("deportes");
  });

  it("clamps 1 to deportes", () => {
    expect(pickRandomCategory(() => 1)).toBe("deportes");
  });

  it("uses Math.random when no generator is injected", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(pickRandomCategory()).toBe("geografia");
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
