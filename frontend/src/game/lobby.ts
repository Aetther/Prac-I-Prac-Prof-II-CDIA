import type {
  GameMode,
  Lang,
  LobbyConfig,
  RoundsCount,
  SecondsPerQuestion,
} from "./types";

/** The longest player name, counted without the spaces at either end. */
export const MAX_PLAYER_NAME_LENGTH = 15;

/** The Lobby choices, in the order they are shown. */
export const SECONDS_OPTIONS: readonly SecondsPerQuestion[] = [30, 20, 10];
export const ROUNDS_OPTIONS: readonly RoundsCount[] = [3, 5, 10];
export const GAME_MODES: readonly GameMode[] = ["rounds", "six-categories"];

export type LobbyInput =
  | {
      readonly playerNames: readonly [string, string];
      readonly lang: Lang;
      readonly secondsPerQuestion: SecondsPerQuestion;
      readonly mode: "rounds";
      readonly rounds: RoundsCount;
    }
  | {
      readonly playerNames: readonly [string, string];
      readonly lang: Lang;
      readonly secondsPerQuestion: SecondsPerQuestion;
      readonly mode: "six-categories";
    };

export interface LobbyDefaults {
  readonly lang: Lang;
  readonly secondsPerQuestion: SecondsPerQuestion;
  readonly mode: "rounds";
  readonly rounds: RoundsCount;
}

export const DEFAULT_LOBBY_SETTINGS: LobbyDefaults = {
  lang: "es",
  secondsPerQuestion: 20,
  mode: "rounds",
  rounds: 5,
};

export function isValidPlayerName(name: string): boolean {
  const length = name.trim().length;
  return length > 0 && length <= MAX_PLAYER_NAME_LENGTH;
}

export function createLobbyConfig(input: LobbyInput): LobbyConfig | null {
  const [first, second] = input.playerNames;
  if (!isValidPlayerName(first) || !isValidPlayerName(second)) {
    return null;
  }
  const base = {
    playerNames: [first.trim(), second.trim()] as const,
    lang: input.lang,
    secondsPerQuestion: input.secondsPerQuestion,
  };
  if (input.mode === "six-categories") {
    return { ...base, mode: "six-categories" };
  }
  return { ...base, mode: "rounds", rounds: input.rounds };
}
