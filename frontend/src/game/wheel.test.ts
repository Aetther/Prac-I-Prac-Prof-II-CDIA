// @vitest-environment node
import { describe, expect, it } from "vitest";
import { CATEGORY_NAMES } from "./category";
import {
  INITIAL_WHEEL_ROTATION,
  MAX_FULL_TURNS,
  MAX_SPIN_DURATION_MS,
  MIN_FULL_TURNS,
  MIN_SPIN_DURATION_MS,
  TARGET_MARGIN_RATIO,
  WHEEL_SLICE_ANGLE,
  clamp01,
  createSpinPlan,
  easeOutCubic,
  normalizeAngle,
  rotationAtElapsed,
  sectorCategoryAtRotation,
  sectorIndexAtRotation,
  sectorIndicesCrossed,
} from "./wheel";

const TWO_PI = Math.PI * 2;

function planFor(startRotation: number, values: readonly number[]) {
  let index = 0;
  return createSpinPlan(startRotation, () => values[index++]);
}

function pointerOffset(rotation: number): number {
  const ratio = normalizeAngle(-rotation) / WHEEL_SLICE_ANGLE;
  return ratio - Math.floor(ratio);
}

describe("wheel geometry", () => {
  it("normalizeAngle wraps any angle into [0, 2π)", () => {
    const cases: readonly (readonly [number, number])[] = [
      [0, 0],
      [TWO_PI, 0],
      [-Math.PI / 2, (3 * Math.PI) / 2],
      [3 * Math.PI, Math.PI],
      [-7 * Math.PI, Math.PI],
      [4 * Math.PI, 0],
    ];

    for (const [angle, expected] of cases) {
      expect(normalizeAngle(angle)).toBeCloseTo(expected, 10);
    }
  });

  it("clamp01 clamps outside the unit interval and keeps its ends", () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(1.5)).toBe(1);
    expect(clamp01(0)).toBe(0);
    expect(clamp01(1)).toBe(1);
  });

  it("createSpinPlan with a zero generator gives the minimum 4000 ms, four-turn plan", () => {
    const plan = createSpinPlan(INITIAL_WHEEL_ROTATION, () => 0);

    expect(plan.durationMs).toBe(MIN_SPIN_DURATION_MS);
    expect(plan.durationMs).toBe(4000);
    expect(plan.fullTurns).toBe(MIN_FULL_TURNS);
    expect(plan.fullTurns).toBe(4);
    expect(plan.targetSectorIndex).toBe(0);
    expect(plan.endRotation - plan.startRotation).toBeCloseTo(
      MIN_FULL_TURNS * TWO_PI + 0.35 * WHEEL_SLICE_ANGLE,
      10,
    );
    expect(sectorIndexAtRotation(plan.endRotation)).toBe(0);
    expect(pointerOffset(plan.endRotation)).toBeCloseTo(
      TARGET_MARGIN_RATIO,
      10,
    );
  });

  it("createSpinPlan with a one generator caps the duration and turns at the maximum", () => {
    const plan = createSpinPlan(INITIAL_WHEEL_ROTATION, () => 1);

    expect(plan.durationMs).toBe(MAX_SPIN_DURATION_MS);
    expect(plan.durationMs).toBe(6000);
    expect(plan.fullTurns).toBe(MAX_FULL_TURNS);
    expect(plan.fullTurns).toBe(6);
    expect(plan.targetSectorIndex).toBe(5);
    expect(pointerOffset(plan.endRotation)).toBeCloseTo(0.85, 10);
    expect(sectorIndexAtRotation(plan.endRotation)).toBe(5);
  });

  it("createSpinPlan draws duration, turns, sector and offset in that order", () => {
    const draws: number[] = [];
    const plan = createSpinPlan(0, () => {
      draws.push(0.5);
      return 0.5;
    });

    expect(draws).toHaveLength(4);
    expect(plan.durationMs).toBe(5000);
    expect(plan.fullTurns).toBe(5);
    expect(plan.targetSectorIndex).toBe(3);
    expect(pointerOffset(plan.endRotation)).toBeCloseTo(0.5, 10);
  });

  it("createSpinPlan clamps random values below zero and above one", () => {
    const below = createSpinPlan(INITIAL_WHEEL_ROTATION, () => -1);
    const zero = createSpinPlan(INITIAL_WHEEL_ROTATION, () => 0);
    const above = createSpinPlan(INITIAL_WHEEL_ROTATION, () => 1.5);
    const one = createSpinPlan(INITIAL_WHEEL_ROTATION, () => 1);

    expect(below).toEqual(zero);
    expect(above).toEqual(one);
    expect(above.durationMs).toBe(6000);
    expect(above.fullTurns).toBe(6);
    expect(above.targetSectorIndex).toBe(5);
  });

  it("createSpinPlan from a non-zero start ends inside the target sector after at least four turns", () => {
    const start = 1.234;
    const plan = planFor(start, [0.2, 0.4, 0.6, 0.8]);

    expect(plan.endRotation).toBeGreaterThan(start);
    expect(plan.endRotation - start).toBeGreaterThanOrEqual(4 * TWO_PI);
    expect(plan.targetSectorIndex).toBe(3);
    expect(sectorIndexAtRotation(plan.endRotation)).toBe(
      plan.targetSectorIndex,
    );
    expect(sectorCategoryAtRotation(plan.endRotation)).toBe("arte");
  });

  it("createSpinPlan stops at different in-sector offsets inside the same target sector", () => {
    const start = 0;
    const low = planFor(start, [0.5, 0.5, 0.4, 0]);
    const high = planFor(start, [0.5, 0.5, 0.4, 1]);
    const lowRatio = pointerOffset(low.endRotation);
    const highRatio = pointerOffset(high.endRotation);

    expect(low.targetSectorIndex).toBe(2);
    expect(high.targetSectorIndex).toBe(2);
    expect(lowRatio).toBeCloseTo(TARGET_MARGIN_RATIO, 10);
    expect(highRatio).toBeCloseTo(0.85, 10);
    expect(Math.abs(high.endRotation - low.endRotation)).toBeGreaterThan(
      0.6 * WHEEL_SLICE_ANGLE,
    );
    expect(sectorIndexAtRotation(low.endRotation)).toBe(2);
    expect(sectorIndexAtRotation(high.endRotation)).toBe(2);
  });

  it("easeOutCubic is 0 at 0, 1 at 1, and 0.875 at half time", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 10);
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(2)).toBe(1);
  });

  it("rotationAtElapsed returns the start at or before zero and the end at or after the duration", () => {
    const plan = createSpinPlan(INITIAL_WHEEL_ROTATION, () => 0);

    expect(rotationAtElapsed(plan, -1)).toBe(plan.startRotation);
    expect(rotationAtElapsed(plan, 0)).toBe(plan.startRotation);
    expect(rotationAtElapsed(plan, plan.durationMs)).toBe(plan.endRotation);
    expect(rotationAtElapsed(plan, plan.durationMs + 1)).toBe(plan.endRotation);
  });

  it("rotationAtElapsed moves more than half the distance at half time", () => {
    const plan = createSpinPlan(INITIAL_WHEEL_ROTATION, () => 0);
    const total = plan.endRotation - plan.startRotation;
    const half = rotationAtElapsed(plan, plan.durationMs / 2);
    const quarter = rotationAtElapsed(plan, plan.durationMs / 4);
    const threeQuarters = rotationAtElapsed(plan, (plan.durationMs * 3) / 4);

    expect((half - plan.startRotation) / total).toBeCloseTo(0.875, 10);
    expect((half - plan.startRotation) / total).toBeGreaterThan(0.5);
    expect(quarter).toBeGreaterThan(plan.startRotation);
    expect(half).toBeGreaterThan(quarter);
    expect(threeQuarters).toBeGreaterThan(half);
    expect(half).toBeLessThan(plan.endRotation);
  });

  it("sectorIndexAtRotation maps pointer angles to the six sectors", () => {
    const rotations = [
      0,
      -WHEEL_SLICE_ANGLE / 2,
      -WHEEL_SLICE_ANGLE,
      -1.5 * WHEEL_SLICE_ANGLE,
      TWO_PI,
      -TWO_PI,
    ];
    const expected = [0, 0, 1, 1, 0, 0];

    expect(rotations.map(sectorIndexAtRotation)).toEqual(expected);
    for (const rotation of rotations) {
      const index = sectorIndexAtRotation(rotation);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThanOrEqual(5);
    }
  });

  it("sectorIndexAtRotation stays on the correct side of the slice boundary", () => {
    expect(sectorIndexAtRotation(-WHEEL_SLICE_ANGLE + 1e-9)).toBe(0);
    expect(sectorIndexAtRotation(-WHEEL_SLICE_ANGLE)).toBe(1);
    expect(sectorIndexAtRotation(-WHEEL_SLICE_ANGLE - 1e-9)).toBe(1);
  });

  it("sectorCategoryAtRotation returns the declared category for every sector", () => {
    const names = CATEGORY_NAMES.map((_, index) =>
      sectorCategoryAtRotation(-(index + 0.5) * WHEEL_SLICE_ANGLE),
    );

    expect(names).toEqual([
      "geografia",
      "historia",
      "ciencia",
      "arte",
      "entretenimiento",
      "deportes",
    ]);
  });
});

describe("sector crossings", () => {
  it("sectorIndicesCrossed returns no tick for an equal or decreasing rotation", () => {
    expect(sectorIndicesCrossed(0, 0)).toEqual([]);
    expect(sectorIndicesCrossed(0.5, 0.4)).toEqual([]);
  });

  it("sectorIndicesCrossed returns the entered sector at a single boundary", () => {
    const crossed = sectorIndicesCrossed(
      -1.2 * WHEEL_SLICE_ANGLE,
      -0.8 * WHEEL_SLICE_ANGLE,
    );

    expect(crossed).toEqual([0]);
    expect(crossed).toHaveLength(1);
  });

  it("sectorIndicesCrossed counts a boundary exactly at the starting angle", () => {
    expect(sectorIndicesCrossed(0, 0.1 * WHEEL_SLICE_ANGLE)).toEqual([5]);
    expect(
      sectorIndicesCrossed(-WHEEL_SLICE_ANGLE, -0.9 * WHEEL_SLICE_ANGLE),
    ).toEqual([0]);
  });

  it("sectorIndicesCrossed lists one full turn as five down to zero", () => {
    const crossed = sectorIndicesCrossed(0, TWO_PI);

    expect(crossed).toEqual([5, 4, 3, 2, 1, 0]);
    expect(crossed).toHaveLength(6);
  });

  it("sectorIndicesCrossed counts the frozen 24-tick plan from the initial rotation", () => {
    const plan = createSpinPlan(INITIAL_WHEEL_ROTATION, () => 0);
    const crossed = sectorIndicesCrossed(plan.startRotation, plan.endRotation);

    expect(crossed).toHaveLength(24);
    expect(crossed).toEqual(
      Array.from({ length: 4 }, () => [5, 4, 3, 2, 1, 0]).flat(),
    );
    expect(crossed[0]).toBe(5);
    expect(crossed[crossed.length - 1]).toBe(0);
  });

  it("sectorIndicesCrossed wraps a large multi-turn jump without losing a sector", () => {
    const crossed = sectorIndicesCrossed(
      0,
      4 * Math.PI + 0.5 * WHEEL_SLICE_ANGLE,
    );

    expect(crossed).toHaveLength(13);
    expect(crossed[0]).toBe(5);
    expect(crossed[crossed.length - 1]).toBe(5);
    expect(new Set(crossed)).toEqual(new Set([0, 1, 2, 3, 4, 5]));
    for (const index of crossed) {
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThanOrEqual(5);
    }
  });
});
