// @vitest-environment node
import { describe, expect, it } from "vitest";
import { SOUND_EFFECTS, SOUND_RECIPES, recipeLength } from "./recipes";

describe("sound recipes", () => {
  it("REC-01 every effect has a recipe and every recipe is listed", () => {
    expect([...SOUND_EFFECTS].sort()).toEqual(
      Object.keys(SOUND_RECIPES).sort(),
    );
    expect(SOUND_EFFECTS).toHaveLength(7);
  });

  it("REC-02 every recipe has audible, quiet, well-formed notes", () => {
    for (const effect of SOUND_EFFECTS) {
      const recipe = SOUND_RECIPES[effect];
      expect(recipe.notes.length).toBeGreaterThan(0);
      expect(recipe.peak).toBeGreaterThan(0);
      expect(recipe.peak).toBeLessThanOrEqual(0.3);
      for (const note of recipe.notes) {
        expect(note.frequency).toBeGreaterThanOrEqual(20);
        expect(note.frequency).toBeLessThanOrEqual(20000);
        expect(note.start).toBeGreaterThanOrEqual(0);
        expect(note.duration).toBeGreaterThan(0);
      }
    }
  });

  it("REC-03 the outcome sounds differ from each other", () => {
    const signature = (effect: "correct" | "wrong" | "timeout") =>
      JSON.stringify(SOUND_RECIPES[effect]);
    expect(
      new Set([signature("correct"), signature("wrong"), signature("timeout")])
        .size,
    ).toBe(3);
  });

  it("REC-04 the tick is short enough for a fast spin and the fanfare is the longest", () => {
    expect(recipeLength(SOUND_RECIPES.tick)).toBeLessThanOrEqual(0.04);
    const lengths = SOUND_EFFECTS.map((effect) =>
      recipeLength(SOUND_RECIPES[effect]),
    );
    expect(recipeLength(SOUND_RECIPES.victory)).toBe(Math.max(...lengths));
  });

  it("REC-05 recipeLength is the end of the last note, and 0 with no notes", () => {
    expect(
      recipeLength({
        type: "sine",
        peak: 0.1,
        notes: [
          { frequency: 440, start: 0.5, duration: 0.1 },
          { frequency: 440, start: 0, duration: 0.2 },
        ],
      }),
    ).toBeCloseTo(0.6);
    expect(recipeLength({ type: "sine", peak: 0.1, notes: [] })).toBe(0);
  });
});
