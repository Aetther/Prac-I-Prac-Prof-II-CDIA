// @vitest-environment node
import { describe, expect, it } from "vitest";
import { SIX_CATEGORIES } from "../test/wheelFixtures";
import { buildWheelCategories } from "../game/category";
import { ENGLISH_CATEGORY_LABELS, localizeCategories } from "./categories";

const wheel = buildWheelCategories(SIX_CATEGORIES);

describe("localizeCategories", () => {
  it("CAT-I18N-01 Spanish returns the API labels untouched", () => {
    expect(wheel).not.toBeNull();
    expect(localizeCategories(wheel!, "es")).toBe(wheel);
  });

  it("CAT-I18N-02 English replaces every label and keeps every name in order", () => {
    const english = localizeCategories(wheel!, "en");
    expect(english.map((category) => category.name)).toEqual(
      wheel!.map((category) => category.name),
    );
    expect(english.map((category) => category.label)).toEqual([
      "Geography",
      "History",
      "Science",
      "Art",
      "Entertainment",
      "Sports",
    ]);
  });

  it("CAT-I18N-03 there is one English label per category", () => {
    expect(Object.keys(ENGLISH_CATEGORY_LABELS).sort()).toEqual(
      wheel!.map((category) => category.name).sort(),
    );
  });
});
