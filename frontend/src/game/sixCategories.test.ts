// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { CategoryName, CategoryOwners, TurnsPlayed } from "./types";
import {
  CATEGORIES_TO_WIN,
  TURN_LIMIT,
  applySixCategoriesAnswer,
  computeCategoryWin,
  computeTurnLimitResult,
  isSixCategoriesResult,
  isTurnLimitReached,
} from "./sixCategories";
import type { SixCategoriesAnswerInput } from "./sixCategories";

const five: readonly CategoryName[] = [
  "geografia",
  "historia",
  "ciencia",
  "arte",
  "entretenimiento",
];

function owners(
  first: readonly CategoryName[],
  second: readonly CategoryName[],
): CategoryOwners {
  return [first, second];
}

function sixState(
  overrides: Partial<SixCategoriesAnswerInput> = {},
): SixCategoriesAnswerInput {
  return {
    ownedCategories: [[], []],
    turnsPlayed: [0, 0],
    currentPlayer: 0,
    category: "geografia",
    correct: true,
    ...overrides,
  };
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.freeze(value);
    for (const key of Object.keys(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

describe("six-categories rules", () => {
  it("SC-01 applySixCategoriesAnswer adds one new category, keeps the turn and does not count a turn", () => {
    expect(applySixCategoriesAnswer(sixState())).toStrictEqual({
      ownedCategories: [["geografia"], []],
      turnsPlayed: [0, 0],
      keepsTurn: true,
      result: null,
    });
  });

  it("SC-02 applySixCategoriesAnswer on an owned category keeps one entry, the turn and the turn count", () => {
    expect(
      applySixCategoriesAnswer(
        sixState({ ownedCategories: [["geografia"], []], turnsPlayed: [3, 2] }),
      ),
    ).toStrictEqual({
      ownedCategories: [["geografia"], []],
      turnsPlayed: [3, 2],
      keepsTurn: true,
      result: null,
    });
  });

  it("SC-03 applySixCategoriesAnswer on a wrong answer adds no category, increments the acting entry once and passes the turn", () => {
    expect(
      applySixCategoriesAnswer(
        sixState({ category: "historia", correct: false }),
      ),
    ).toStrictEqual({
      ownedCategories: [[], []],
      turnsPlayed: [1, 0],
      keepsTurn: false,
      result: null,
    });
  });

  it("SC-04 applySixCategoriesAnswer treats a timeout as a failure and increments the turn once", () => {
    expect(
      applySixCategoriesAnswer(
        sixState({ turnsPlayed: [1, 0], correct: false }),
      ),
    ).toStrictEqual({
      ownedCategories: [[], []],
      turnsPlayed: [2, 0],
      keepsTurn: false,
      result: null,
    });
  });

  it("SC-05 applySixCategoriesAnswer ignores an undeclared served category and does not count a correct answer", () => {
    expect(
      applySixCategoriesAnswer(
        sixState({
          ownedCategories: [["geografia"], []],
          turnsPlayed: [2, 2],
          category: "otra",
        }),
      ),
    ).toStrictEqual({
      ownedCategories: [["geografia"], []],
      turnsPlayed: [2, 2],
      keepsTurn: true,
      result: null,
    });
  });

  it("SC-06 a five-correct streak leaves turnsPlayed at zero", () => {
    let outcome = applySixCategoriesAnswer(
      sixState({
        ownedCategories: [[], []],
        turnsPlayed: [0, 0],
        category: five[0],
      }),
    );
    expect(outcome.turnsPlayed).toStrictEqual([0, 0]);

    for (const category of five.slice(1)) {
      outcome = applySixCategoriesAnswer({
        ownedCategories: outcome.ownedCategories,
        turnsPlayed: outcome.turnsPlayed,
        currentPlayer: 0,
        category,
        correct: true,
      });
      expect(outcome.turnsPlayed).toStrictEqual([0, 0]);
    }

    expect(outcome.ownedCategories).toStrictEqual([[...five], []]);
    expect(outcome.keepsTurn).toBe(true);
    expect(outcome.result).toBeNull();
  });

  it("SC-07 a sixth correct answer on an owned category and the failure that ends the streak count one turn", () => {
    const afterSixth = applySixCategoriesAnswer(
      sixState({
        ownedCategories: [[...five], []],
        turnsPlayed: [0, 0],
        category: "geografia",
      }),
    );

    expect(afterSixth.turnsPlayed).toStrictEqual([0, 0]);
    expect(afterSixth.ownedCategories).toStrictEqual([[...five], []]);
    expect(afterSixth.result).toBeNull();

    const afterFailure = applySixCategoriesAnswer({
      ownedCategories: afterSixth.ownedCategories,
      turnsPlayed: afterSixth.turnsPlayed,
      currentPlayer: 0,
      category: "deportes",
      correct: false,
    });

    expect(afterFailure.turnsPlayed).toStrictEqual([1, 0]);
    expect(afterFailure.keepsTurn).toBe(false);
    expect(afterFailure.result).toBeNull();
  });

  it("SC-08 player 1 finishing turn 20 leaves [20, 19] with no result", () => {
    expect(
      applySixCategoriesAnswer(
        sixState({
          ownedCategories: owners(
            ["geografia", "historia", "ciencia", "arte"],
            ["deportes", "entretenimiento"],
          ),
          turnsPlayed: [19, 19],
          currentPlayer: 0,
          category: "deportes",
          correct: false,
        }),
      ),
    ).toStrictEqual({
      ownedCategories: owners(
        ["geografia", "historia", "ciencia", "arte"],
        ["deportes", "entretenimiento"],
      ),
      turnsPlayed: [20, 19],
      keepsTurn: false,
      result: null,
    });
  });

  it("SC-09 player 2 finishing turn 20 sets the turn-limit result at [20, 20]", () => {
    expect(
      applySixCategoriesAnswer(
        sixState({
          ownedCategories: owners(
            ["geografia", "historia", "ciencia", "arte"],
            ["deportes", "entretenimiento"],
          ),
          turnsPlayed: [20, 19],
          currentPlayer: 1,
          category: "deportes",
          correct: false,
        }),
      ).result,
    ).toStrictEqual({
      mode: "six-categories",
      kind: "winner",
      winnerIndex: 0,
      categories: [4, 2],
      reason: "turn-limit",
    });

    expect(
      applySixCategoriesAnswer(
        sixState({
          ownedCategories: owners(
            ["geografia", "historia", "ciencia"],
            ["arte", "entretenimiento", "deportes"],
          ),
          turnsPlayed: [20, 19],
          currentPlayer: 1,
          category: "deportes",
          correct: false,
        }),
      ).result,
    ).toStrictEqual({
      mode: "six-categories",
      kind: "tie",
      categories: [3, 3],
      reason: "turn-limit",
    });
  });

  it("SC-10 isTurnLimitReached is true only when both entries are 20", () => {
    expect(isTurnLimitReached([20, 19])).toBe(false);
    expect(isTurnLimitReached([19, 20])).toBe(false);
    expect(isTurnLimitReached([20, 20])).toBe(true);
    expect(isTurnLimitReached([19, 19])).toBe(false);
    expect(isTurnLimitReached([0, 0])).toBe(false);
  });

  it("SC-11 a sixth category before the limit ends by the category reason with turns unchanged", () => {
    expect(
      applySixCategoriesAnswer(
        sixState({
          ownedCategories: owners([...five], ["historia", "arte"]),
          turnsPlayed: [19, 19],
          currentPlayer: 0,
          category: "deportes",
        }),
      ),
    ).toStrictEqual({
      ownedCategories: owners([...five, "deportes"], ["historia", "arte"]),
      turnsPlayed: [19, 19],
      keepsTurn: true,
      result: {
        mode: "six-categories",
        kind: "winner",
        winnerIndex: 0,
        categories: [6, 2],
        reason: "six-categories",
      },
    });
  });

  it("SC-12 player 2's sixth category on the last turn wins at [20, 19]", () => {
    expect(
      applySixCategoriesAnswer(
        sixState({
          ownedCategories: owners(["historia", "arte"], [...five]),
          turnsPlayed: [20, 19],
          currentPlayer: 1,
          category: "deportes",
        }),
      ),
    ).toStrictEqual({
      ownedCategories: owners(["historia", "arte"], [...five, "deportes"]),
      turnsPlayed: [20, 19],
      keepsTurn: true,
      result: {
        mode: "six-categories",
        kind: "winner",
        winnerIndex: 1,
        categories: [2, 6],
        reason: "six-categories",
      },
    });
  });

  it("SC-13 a correct answer during player 2's turn at [20, 19] sets no result and keeps the turn", () => {
    expect(
      applySixCategoriesAnswer(
        sixState({
          ownedCategories: owners(
            ["geografia", "historia", "ciencia", "arte"],
            [...five],
          ),
          turnsPlayed: [20, 19],
          currentPlayer: 1,
          category: "geografia",
        }),
      ),
    ).toStrictEqual({
      ownedCategories: owners(
        ["geografia", "historia", "ciencia", "arte"],
        [...five],
      ),
      turnsPlayed: [20, 19],
      keepsTurn: true,
      result: null,
    });
  });

  it("SC-14 the turn-limit builder returns the exact winner and tie shapes", () => {
    expect(
      computeTurnLimitResult(
        owners(
          ["geografia", "historia", "ciencia", "arte"],
          ["deportes", "entretenimiento"],
        ),
      ),
    ).toStrictEqual({
      mode: "six-categories",
      kind: "winner",
      winnerIndex: 0,
      categories: [4, 2],
      reason: "turn-limit",
    });
    expect(
      computeCategoryWin(
        owners([...five, "deportes"], ["geografia", "historia"]),
        0,
      ),
    ).toStrictEqual({
      mode: "six-categories",
      kind: "winner",
      winnerIndex: 0,
      categories: [6, 2],
      reason: "six-categories",
    });
    expect(
      computeTurnLimitResult(
        owners(
          ["geografia", "historia", "ciencia"],
          ["arte", "entretenimiento", "deportes"],
        ),
      ),
    ).toStrictEqual({
      mode: "six-categories",
      kind: "tie",
      categories: [3, 3],
      reason: "turn-limit",
    });
  });

  it("SC-15 the builders pick the higher count and tie equal counts", () => {
    expect(
      computeTurnLimitResult(
        owners(
          ["geografia", "historia"],
          ["ciencia", "arte", "entretenimiento", "deportes"],
        ),
      ),
    ).toMatchObject({ kind: "winner", winnerIndex: 1 });
    expect(
      computeTurnLimitResult(
        owners(
          ["geografia", "historia", "ciencia"],
          ["arte", "entretenimiento", "deportes"],
        ),
      ),
    ).toMatchObject({ kind: "tie" });
    expect(
      computeCategoryWin(
        owners(
          [
            "geografia",
            "historia",
            "ciencia",
            "arte",
            "entretenimiento",
            "deportes",
          ],
          ["geografia", "historia", "ciencia", "arte"],
        ),
        0,
      ),
    ).toMatchObject({ kind: "winner", winnerIndex: 0 });
  });

  it("SC-16 isSixCategoriesResult distinguishes the six result from both rounds results", () => {
    expect(
      isSixCategoriesResult({
        mode: "six-categories",
        kind: "winner",
        winnerIndex: 0,
        categories: [6, 2],
        reason: "six-categories",
      }),
    ).toBe(true);
    expect(
      isSixCategoriesResult({
        mode: "six-categories",
        kind: "tie",
        categories: [3, 3],
        reason: "turn-limit",
      }),
    ).toBe(true);
    expect(
      isSixCategoriesResult({
        kind: "winner",
        winnerIndex: 0,
        scores: [10, 0],
      }),
    ).toBe(false);
    expect(isSixCategoriesResult({ kind: "tie", scores: [0, 0] })).toBe(false);
  });

  it("SC-17 applySixCategoriesAnswer does not mutate its input tuples", () => {
    const input = deepFreeze(
      sixState({
        ownedCategories: owners([...five], ["historia"]),
        turnsPlayed: [19, 19],
        currentPlayer: 0,
        category: "deportes",
      }),
    );
    const snapshot = JSON.stringify(input);

    expect(applySixCategoriesAnswer(input)).toStrictEqual({
      ownedCategories: owners([...five, "deportes"], ["historia"]),
      turnsPlayed: [19, 19],
      keepsTurn: true,
      result: {
        mode: "six-categories",
        kind: "winner",
        winnerIndex: 0,
        categories: [6, 1],
        reason: "six-categories",
      },
    });
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("SC-18 TURN_LIMIT and CATEGORIES_TO_WIN pin the declared values", () => {
    expect(TURN_LIMIT).toBe(20);
    expect(CATEGORIES_TO_WIN).toBe(6);
  });

  it("SC-19 applySixCategoriesAnswer increments only the acting player", () => {
    const firstWrong = applySixCategoriesAnswer(
      sixState({ turnsPlayed: [0, 0], currentPlayer: 0, correct: false }),
    );
    expect(firstWrong.turnsPlayed).toStrictEqual([1, 0]);

    const secondWrong = applySixCategoriesAnswer(
      sixState({
        turnsPlayed: firstWrong.turnsPlayed as TurnsPlayed,
        currentPlayer: 1,
        correct: false,
      }),
    );
    expect(secondWrong.turnsPlayed).toStrictEqual([1, 1]);

    const correct = applySixCategoriesAnswer(
      sixState({
        ownedCategories: secondWrong.ownedCategories,
        turnsPlayed: secondWrong.turnsPlayed,
        currentPlayer: 0,
        correct: true,
      }),
    );
    expect(correct.turnsPlayed).toStrictEqual([1, 1]);
  });
});
