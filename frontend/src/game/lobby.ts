import type {
  Lang,
  LobbyConfig,
  RoundsCount,
  SecondsPerQuestion,
} from "./types";

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
  return name.trim().length > 0;
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
