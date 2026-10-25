import type {
  Lang,
  LobbyConfig,
  RoundsCount,
  SecondsPerQuestion,
} from "./types";

export interface LobbyInput {
  readonly playerNames: readonly [string, string];
  readonly lang: Lang;
  readonly secondsPerQuestion: SecondsPerQuestion;
  readonly rounds: RoundsCount;
}

export const DEFAULT_LOBBY_SETTINGS: Pick<
  LobbyConfig,
  "lang" | "secondsPerQuestion" | "rounds"
> = {
  lang: "es",
  secondsPerQuestion: 20,
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
  return {
    playerNames: [first.trim(), second.trim()],
    lang: input.lang,
    secondsPerQuestion: input.secondsPerQuestion,
    mode: "rounds",
    rounds: input.rounds,
  };
}
