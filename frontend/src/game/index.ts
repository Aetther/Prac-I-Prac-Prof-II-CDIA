import type { GamePhase } from "./types";

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
