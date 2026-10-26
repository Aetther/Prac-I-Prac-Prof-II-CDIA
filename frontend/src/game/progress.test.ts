// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getMatchProgress } from "./progress";
import type { RoundsLobbyConfig, SixCategoriesLobbyConfig } from "./types";

const roundsConfig = (rounds: 3 | 5 | 10): RoundsLobbyConfig => ({
  playerNames: ["Ana", "Beto"],
  lang: "es",
  secondsPerQuestion: 20,
  mode: "rounds",
  rounds,
});

const sixConfig: SixCategoriesLobbyConfig = {
  playerNames: ["Ana", "Beto"],
  lang: "es",
  secondsPerQuestion: 20,
  mode: "six-categories",
};

describe("match progress", () => {
  it.each([3, 5, 10] as const)(
    "PRG-01 getMatchProgress returns the rounds progress (%i rounds)",
    (rounds) => {
      expect(
        getMatchProgress(roundsConfig(rounds), {
          round: 2,
          ownedCategories: [[], []],
          turnsPlayed: [0, 0],
        }),
      ).toStrictEqual({ mode: "rounds", round: 2, totalRounds: rounds });
    },
  );

  it("PRG-02 getMatchProgress returns the six-categories progress", () => {
    expect(
      getMatchProgress(sixConfig, {
        round: 1,
        ownedCategories: [["geografia"], ["historia", "arte"]],
        turnsPlayed: [7, 3],
      }),
    ).toStrictEqual({
      mode: "six-categories",
      ownedCategories: [["geografia"], ["historia", "arte"]],
      turnsPlayed: [7, 3],
    });
  });

  it("PRG-03 getMatchProgress ignores the round in six mode", () => {
    const progress = getMatchProgress(sixConfig, {
      round: 9,
      ownedCategories: [["geografia"], []],
      turnsPlayed: [1, 0],
    });

    expect(progress).toStrictEqual({
      mode: "six-categories",
      ownedCategories: [["geografia"], []],
      turnsPlayed: [1, 0],
    });
    expect(progress).not.toHaveProperty("round");
  });
});
