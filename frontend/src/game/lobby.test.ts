// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOBBY_SETTINGS,
  createLobbyConfig,
  isValidPlayerName,
} from "./lobby";
import type { LobbyInput } from "./lobby";

describe("lobby rules", () => {
  it("returns the exact default lobby settings with the rounds mode", () => {
    expect(DEFAULT_LOBBY_SETTINGS).toEqual({
      lang: "es",
      secondsPerQuestion: 20,
      mode: "rounds",
      rounds: 5,
    });
  });

  it("validates player names by non-whitespace content", () => {
    expect(isValidPlayerName("")).toBe(false);
    expect(isValidPlayerName("   ")).toBe(false);
    expect(isValidPlayerName("Ana")).toBe(true);
    expect(isValidPlayerName(" Ana ")).toBe(true);
  });

  it("trims both names and returns the exact LobbyConfig", () => {
    expect(
      createLobbyConfig({
        playerNames: [" Ana ", "Beto"],
        lang: "en",
        secondsPerQuestion: 30,
        mode: "rounds",
        rounds: 3,
      }),
    ).toEqual({
      playerNames: ["Ana", "Beto"],
      lang: "en",
      secondsPerQuestion: 30,
      mode: "rounds",
      rounds: 3,
    });
  });

  it("builds the six-categories config without a rounds property", () => {
    const result = createLobbyConfig({
      playerNames: ["Ana", "Beto"],
      lang: "en",
      secondsPerQuestion: 30,
      mode: "six-categories",
    });

    expect(result).toStrictEqual({
      playerNames: ["Ana", "Beto"],
      lang: "en",
      secondsPerQuestion: 30,
      mode: "six-categories",
    });
    expect(result).not.toHaveProperty("rounds");
    expect(result !== null && "rounds" in result).toBe(false);
  });

  it("returns null for a blank name in both modes", () => {
    const inputs: LobbyInput[] = [
      {
        playerNames: ["", "Beto"],
        lang: "es",
        secondsPerQuestion: 20,
        mode: "rounds",
        rounds: 5,
      },
      {
        playerNames: ["Ana", "   "],
        lang: "es",
        secondsPerQuestion: 20,
        mode: "rounds",
        rounds: 5,
      },
      {
        playerNames: ["", "Beto"],
        lang: "es",
        secondsPerQuestion: 20,
        mode: "six-categories",
      },
      {
        playerNames: ["Ana", "   "],
        lang: "es",
        secondsPerQuestion: 20,
        mode: "six-categories",
      },
    ];

    for (const input of inputs) {
      expect(createLobbyConfig(input)).toBeNull();
    }
  });

  it("returns null when the first name is blank", () => {
    expect(
      createLobbyConfig({
        playerNames: ["", "Beto"],
        lang: "es",
        secondsPerQuestion: 20,
        mode: "rounds",
        rounds: 5,
      }),
    ).toBeNull();
    expect(
      createLobbyConfig({
        playerNames: ["   ", "Beto"],
        lang: "es",
        secondsPerQuestion: 20,
        mode: "rounds",
        rounds: 5,
      }),
    ).toBeNull();
  });

  it("returns null when only the second name is blank", () => {
    expect(
      createLobbyConfig({
        playerNames: ["Ana", "   "],
        lang: "es",
        secondsPerQuestion: 20,
        mode: "rounds",
        rounds: 5,
      }),
    ).toBeNull();
  });

  it("allows two identical names", () => {
    expect(
      createLobbyConfig({
        playerNames: ["Ana", "Ana"],
        lang: "es",
        secondsPerQuestion: 20,
        mode: "rounds",
        rounds: 5,
      })?.playerNames,
    ).toEqual(["Ana", "Ana"]);
  });

  it.each([
    [3, 10],
    [3, 20],
    [3, 30],
    [5, 10],
    [5, 20],
    [5, 30],
    [10, 10],
    [10, 20],
    [10, 30],
  ] as const)(
    "keeps every allowed rounds and seconds value (%i, %i)",
    (rounds, secondsPerQuestion) => {
      expect(
        createLobbyConfig({
          playerNames: ["Ana", "Beto"],
          lang: "es",
          secondsPerQuestion,
          mode: "rounds",
          rounds,
        }),
      ).toMatchObject({ rounds, secondsPerQuestion });
    },
  );
});
