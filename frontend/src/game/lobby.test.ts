// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOBBY_SETTINGS,
  createLobbyConfig,
  isValidPlayerName,
} from "./lobby";

describe("lobby rules", () => {
  it("returns the exact default lobby settings", () => {
    expect(DEFAULT_LOBBY_SETTINGS).toEqual({
      lang: "es",
      secondsPerQuestion: 20,
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

  it("returns null when the first name is blank", () => {
    expect(
      createLobbyConfig({
        playerNames: ["", "Beto"],
        lang: "es",
        secondsPerQuestion: 20,
        rounds: 5,
      }),
    ).toBeNull();
    expect(
      createLobbyConfig({
        playerNames: ["   ", "Beto"],
        lang: "es",
        secondsPerQuestion: 20,
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
          rounds,
        }),
      ).toMatchObject({ rounds, secondsPerQuestion });
    },
  );
});
