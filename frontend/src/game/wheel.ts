import type { CategoryName } from "./types";
import { CATEGORY_NAMES } from "./category";

export const WHEEL_SECTOR_COUNT = 6;
export const WHEEL_SLICE_ANGLE = (Math.PI * 2) / WHEEL_SECTOR_COUNT;
export const MIN_SPIN_DURATION_MS = 4000;
export const MAX_SPIN_DURATION_MS = 6000;
export const MIN_FULL_TURNS = 4;
export const MAX_FULL_TURNS = 6;
export const INITIAL_WHEEL_ROTATION = -WHEEL_SLICE_ANGLE / 2;
export const TARGET_MARGIN_RATIO = 0.15;

const FULL_CIRCLE = Math.PI * 2;

export interface SpinPlan {
  readonly startRotation: number;
  readonly endRotation: number;
  readonly durationMs: number;
  readonly fullTurns: number;
  readonly targetSectorIndex: number;
}

export interface WheelTick {
  readonly sectorIndex: number;
  readonly category: CategoryName;
}

export type WheelTickHandler = (tick: WheelTick) => void;

export function normalizeAngle(angle: number): number {
  return ((angle % FULL_CIRCLE) + FULL_CIRCLE) % FULL_CIRCLE;
}

export function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

export function createSpinPlan(
  startRotation: number,
  random: () => number = Math.random,
): SpinPlan {
  const durationDraw = clamp01(random());
  const turnsDraw = clamp01(random());
  const sectorDraw = clamp01(random());
  const offsetDraw = clamp01(random());

  const durationMs = Math.min(
    MIN_SPIN_DURATION_MS +
      Math.floor(
        durationDraw * (MAX_SPIN_DURATION_MS - MIN_SPIN_DURATION_MS + 1),
      ),
    MAX_SPIN_DURATION_MS,
  );
  const fullTurns = Math.min(
    MIN_FULL_TURNS +
      Math.floor(turnsDraw * (MAX_FULL_TURNS - MIN_FULL_TURNS + 1)),
    MAX_FULL_TURNS,
  );
  const targetSectorIndex = Math.min(
    Math.floor(sectorDraw * WHEEL_SECTOR_COUNT),
    WHEEL_SECTOR_COUNT - 1,
  );
  const offsetRatio =
    TARGET_MARGIN_RATIO + offsetDraw * (1 - 2 * TARGET_MARGIN_RATIO);
  const desiredPointerAngle =
    (targetSectorIndex + offsetRatio) * WHEEL_SLICE_ANGLE;
  const delta = normalizeAngle(-desiredPointerAngle - startRotation);
  const endRotation = startRotation + fullTurns * FULL_CIRCLE + delta;

  return {
    startRotation,
    endRotation,
    durationMs,
    fullTurns,
    targetSectorIndex,
  };
}

export function easeOutCubic(progress: number): number {
  return 1 - (1 - clamp01(progress)) ** 3;
}

export function rotationAtElapsed(plan: SpinPlan, elapsedMs: number): number {
  if (elapsedMs <= 0) return plan.startRotation;
  if (elapsedMs >= plan.durationMs) return plan.endRotation;
  const progress = elapsedMs / plan.durationMs;
  return (
    plan.startRotation +
    (plan.endRotation - plan.startRotation) * easeOutCubic(progress)
  );
}

const BOUNDARY_EPSILON = 1e-12;

export function sectorIndexAtRotation(rotation: number): number {
  const ratio = normalizeAngle(-rotation) / WHEEL_SLICE_ANGLE;
  const nearestInteger = Math.round(ratio);
  // Exact slice boundaries land a float ulp below an integer; keep the
  // half-open floor convention at that boundary instead of dropping a sector.
  if (Math.abs(ratio - nearestInteger) < BOUNDARY_EPSILON) {
    return nearestInteger % WHEEL_SECTOR_COUNT;
  }
  return Math.floor(ratio);
}

export function sectorCategoryAtRotation(rotation: number): CategoryName {
  return CATEGORY_NAMES[sectorIndexAtRotation(rotation)];
}

function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

export function sectorIndicesCrossed(
  previousRotation: number,
  currentRotation: number,
): number[] {
  if (currentRotation <= previousRotation) return [];
  const from = Math.floor(-previousRotation / WHEEL_SLICE_ANGLE);
  const to = Math.floor(-currentRotation / WHEEL_SLICE_ANGLE);
  const count = from - to;
  const crossed: number[] = [];
  for (let step = 0; step < count; step += 1) {
    crossed.push(mod(from - step - 1, WHEEL_SECTOR_COUNT));
  }
  return crossed;
}
