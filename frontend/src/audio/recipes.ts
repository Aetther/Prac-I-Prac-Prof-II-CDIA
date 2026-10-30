export type OscillatorKind = "sine" | "square" | "triangle" | "sawtooth";

export type SoundEffect =
  | "tick"
  | "spinStop"
  | "correct"
  | "wrong"
  | "timeout"
  | "clockTick"
  | "victory";

/** One tone of an effect; times are seconds from the start of the effect. */
export interface RecipeNote {
  readonly frequency: number;
  readonly start: number;
  readonly duration: number;
}

export interface SoundRecipe {
  readonly type: OscillatorKind;
  readonly peak: number;
  readonly notes: readonly RecipeNote[];
}

export const SOUND_EFFECTS: readonly SoundEffect[] = [
  "tick",
  "spinStop",
  "correct",
  "wrong",
  "timeout",
  "clockTick",
  "victory",
];

/** Original effects, synthesized with one oscillator per note. */
export const SOUND_RECIPES: Readonly<Record<SoundEffect, SoundRecipe>> = {
  tick: {
    type: "square",
    peak: 0.15,
    notes: [{ frequency: 1800, start: 0, duration: 0.025 }],
  },
  spinStop: {
    type: "triangle",
    peak: 0.25,
    notes: [
      { frequency: 520, start: 0, duration: 0.07 },
      { frequency: 780, start: 0.08, duration: 0.08 },
    ],
  },
  correct: {
    type: "triangle",
    peak: 0.25,
    notes: [
      { frequency: 523.25, start: 0, duration: 0.1 },
      { frequency: 659.25, start: 0.11, duration: 0.1 },
      { frequency: 783.99, start: 0.22, duration: 0.11 },
    ],
  },
  wrong: {
    type: "sawtooth",
    peak: 0.18,
    notes: [
      { frequency: 220, start: 0, duration: 0.15 },
      { frequency: 174.61, start: 0.16, duration: 0.16 },
    ],
  },
  timeout: {
    type: "square",
    peak: 0.15,
    notes: [
      { frequency: 440, start: 0, duration: 0.13 },
      { frequency: 329.63, start: 0.14, duration: 0.13 },
      { frequency: 246.94, start: 0.28, duration: 0.14 },
    ],
  },
  clockTick: {
    type: "sine",
    peak: 0.2,
    notes: [{ frequency: 1000, start: 0, duration: 0.06 }],
  },
  victory: {
    type: "triangle",
    peak: 0.25,
    notes: [
      { frequency: 392, start: 0, duration: 0.12 },
      { frequency: 523.25, start: 0.13, duration: 0.12 },
      { frequency: 659.25, start: 0.26, duration: 0.12 },
      { frequency: 783.99, start: 0.39, duration: 0.14 },
      { frequency: 1046.5, start: 0.55, duration: 0.55 },
    ],
  },
};

/** Seconds from the start of the recipe to the end of its last note. */
export function recipeLength(recipe: SoundRecipe): number {
  return recipe.notes.reduce(
    (longest, note) => Math.max(longest, note.start + note.duration),
    0,
  );
}
