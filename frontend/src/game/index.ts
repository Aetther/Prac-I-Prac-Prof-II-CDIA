import type { GamePhase } from "./types";

export type * from "./types";
export * from "./lobby";
export * from "./category";
export * from "./wheel";
export * from "./question";
export * from "./errors";
export * from "./reducer";

export { type GamePhase };
export const INITIAL_PHASE: GamePhase = "Lobby";
export const PHASES: GamePhase[] = [
  "Lobby",
  "Wheel",
  "QuestionCard",
  "Result",
  "SwitchTurn",
  "GameOver",
];
