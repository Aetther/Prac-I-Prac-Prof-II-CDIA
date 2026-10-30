import type { UserEvent } from "@testing-library/user-event";

export type LobbyGroup = "language" | "difficulty" | "mode" | "rounds";

function radio(group: LobbyGroup, value: string): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>(
    `.choice-group-${group} input[value="${value}"]`,
  );
  if (input === null) {
    throw new Error(`no Lobby option ${value} in ${group}`);
  }
  return input;
}

/** Picks a Lobby option by its value, whatever the interface language. */
export async function chooseLobbyOption(
  user: UserEvent,
  group: LobbyGroup,
  value: string,
): Promise<void> {
  await user.click(radio(group, value));
}

export const chooseLanguage = (user: UserEvent, lang: "es" | "en") =>
  chooseLobbyOption(user, "language", lang);

/** "30" is Fácil, "20" Intermedia and "10" Difícil. */
export const chooseSeconds = (user: UserEvent, seconds: string) =>
  chooseLobbyOption(user, "difficulty", seconds);

export const chooseMode = (
  user: UserEvent,
  mode: "rounds" | "six-categories",
) => chooseLobbyOption(user, "mode", mode);

export const chooseRounds = (user: UserEvent, rounds: string) =>
  chooseLobbyOption(user, "rounds", rounds);

/** The checked value of a Lobby group, or null when the group is not shown. */
export function lobbyValue(group: LobbyGroup): string | null {
  return (
    document.querySelector<HTMLInputElement>(
      `.choice-group-${group} input:checked`,
    )?.value ?? null
  );
}
