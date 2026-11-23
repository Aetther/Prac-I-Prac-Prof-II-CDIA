// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { CategoryName, CategoryOwners, TurnsPlayed } from "./types";
import {
  CATEGORIES_TO_WIN,
  HITS_PER_CROWN,
  NO_HITS,
  TURN_LIMIT,
  applySixCategoriesAnswer,
  computeCategoryWin,
  computeTurnLimitResult,
  hitsIn,
  isSixCategoriesResult,
  isTurnLimitReached,
  totalHits,
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
    categoryHits: [{}, {}],
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

describe("crowns rules", () => {
  it("SC-01 the rules pin three hits per crown, six crowns and thirty turns", () => {
    expect(HITS_PER_CROWN).toBe(3);
    expect(CATEGORIES_TO_WIN).toBe(6);
    expect(TURN_LIMIT).toBe(30);
    expect(NO_HITS).toStrictEqual([{}, {}]);
  });

  it("SC-02 a first correct answer counts one hit, keeps the turn and wins no crown", () => {
    expect(applySixCategoriesAnswer(sixState())).toStrictEqual({
      ownedCategories: [[], []],
      categoryHits: [{ geografia: 1 }, {}],
      turnsPlayed: [0, 0],
      keepsTurn: true,
      result: null,
      step: { category: "geografia", hits: 1, crowned: false },
    });
  });

  it("SC-03 the third hit wins the crown and adds the category once", () => {
    const outcome = applySixCategoriesAnswer(
      sixState({ categoryHits: [{ geografia: 2, arte: 1 }, { geografia: 2 }] }),
    );
    expect(outcome.ownedCategories).toStrictEqual([["geografia"], []]);
    expect(outcome.categoryHits).toStrictEqual([
      { geografia: 3, arte: 1 },
      { geografia: 2 },
    ]);
    expect(outcome.step).toStrictEqual({
      category: "geografia",
      hits: 3,
      crowned: true,
    });
    expect(outcome.result).toBeNull();
  });

  it("SC-04 a correct answer on a crowned category changes nothing and reports no step", () => {
    const input = sixState({
      ownedCategories: [["geografia"], []],
      categoryHits: [{ geografia: 3 }, {}],
      turnsPlayed: [3, 2],
    });
    expect(applySixCategoriesAnswer(input)).toStrictEqual({
      ownedCategories: [["geografia"], []],
      categoryHits: [{ geografia: 3 }, {}],
      turnsPlayed: [3, 2],
      keepsTurn: true,
      result: null,
      step: null,
    });
  });

  it("SC-05 an owned category counts as a full crown even without a tally", () => {
    expect(hitsIn(["historia"], {}, "historia")).toBe(3);
    expect(hitsIn([], { historia: 2 }, "historia")).toBe(2);
    expect(hitsIn([], { historia: 7 }, "historia")).toBe(3);
    expect(hitsIn([], {}, "historia")).toBe(0);
    const outcome = applySixCategoriesAnswer(
      sixState({
        ownedCategories: [["geografia"], []],
        categoryHits: undefined,
      }),
    );
    expect(outcome.step).toBeNull();
    expect(outcome.categoryHits).toStrictEqual([{}, {}]);
  });

  it("SC-06 a wrong answer or a timeout adds no hit, counts one turn and passes the turn", () => {
    expect(
      applySixCategoriesAnswer(
        sixState({
          category: "historia",
          correct: false,
          categoryHits: [{ historia: 2 }, {}],
          turnsPlayed: [1, 0],
        }),
      ),
    ).toStrictEqual({
      ownedCategories: [[], []],
      categoryHits: [{ historia: 2 }, {}],
      turnsPlayed: [2, 0],
      keepsTurn: false,
      result: null,
      step: null,
    });
  });

  it("SC-07 an undeclared served category counts nothing and keeps the turn", () => {
    expect(
      applySixCategoriesAnswer(
        sixState({ category: "otra", turnsPlayed: [2, 2] }),
      ),
    ).toStrictEqual({
      ownedCategories: [[], []],
      categoryHits: [{}, {}],
      turnsPlayed: [2, 2],
      keepsTurn: true,
      result: null,
      step: null,
    });
  });

  it("SC-08 eighteen correct answers in a row, three per category, win the match without a turn", () => {
    let input = sixState();
    let outcome = applySixCategoriesAnswer(input);
    const order: CategoryName[] = (
      [...five, "deportes"] as CategoryName[]
    ).flatMap((name) => [name, name, name]);
    for (const [index, category] of order.entries()) {
      input = {
        ...input,
        ownedCategories: index === 0 ? [[], []] : outcome.ownedCategories,
        categoryHits: index === 0 ? [{}, {}] : outcome.categoryHits,
        turnsPlayed: index === 0 ? [0, 0] : outcome.turnsPlayed,
        category,
      };
      outcome = applySixCategoriesAnswer(input);
      expect(outcome.turnsPlayed).toStrictEqual([0, 0]);
      if (index < order.length - 1) expect(outcome.result).toBeNull();
    }
    expect(outcome.ownedCategories[0]).toStrictEqual([...five, "deportes"]);
    expect(outcome.result).toStrictEqual({
      mode: "six-categories",
      kind: "winner",
      winnerIndex: 0,
      categories: [6, 0],
      reason: "six-categories",
    });
  });

  it("SC-09 the sixth crown on player 2's last turn wins before the limit", () => {
    expect(
      applySixCategoriesAnswer(
        sixState({
          ownedCategories: owners(["historia", "arte"], [...five]),
          categoryHits: [{}, { deportes: 2 }],
          turnsPlayed: [30, 29],
          currentPlayer: 1,
          category: "deportes",
        }),
      ).result,
    ).toStrictEqual({
      mode: "six-categories",
      kind: "winner",
      winnerIndex: 1,
      categories: [2, 6],
      reason: "six-categories",
    });
  });

  it("SC-10 player 1 finishing turn 30 leaves [30, 29] with no result", () => {
    const outcome = applySixCategoriesAnswer(
      sixState({
        ownedCategories: owners(["geografia"], []),
        turnsPlayed: [29, 29],
        correct: false,
      }),
    );
    expect(outcome.turnsPlayed).toStrictEqual([30, 29]);
    expect(outcome.result).toBeNull();
  });

  it("SC-11 at [30, 30] the most crowns win", () => {
    expect(
      applySixCategoriesAnswer(
        sixState({
          ownedCategories: owners(
            ["geografia", "historia", "ciencia", "arte"],
            ["deportes", "entretenimiento"],
          ),
          turnsPlayed: [30, 29],
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
  });

  it("SC-12 equal crowns at the limit are decided by the accumulated hits", () => {
    expect(
      applySixCategoriesAnswer(
        sixState({
          ownedCategories: owners(["geografia"], ["arte"]),
          categoryHits: [
            { geografia: 3, historia: 1 },
            { arte: 3, ciencia: 2, deportes: 1 },
          ],
          turnsPlayed: [30, 29],
          currentPlayer: 1,
          correct: false,
        }),
      ).result,
    ).toStrictEqual({
      mode: "six-categories",
      kind: "winner",
      winnerIndex: 1,
      categories: [1, 1],
      reason: "turn-limit",
      hits: [4, 6],
    });
  });

  it("SC-13 equal crowns and equal hits at the limit are a tie", () => {
    expect(
      computeTurnLimitResult(owners(["geografia"], ["arte"]), [
        { geografia: 3, historia: 2 },
        { arte: 3, ciencia: 2 },
      ]),
    ).toStrictEqual({
      mode: "six-categories",
      kind: "tie",
      categories: [1, 1],
      reason: "turn-limit",
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

  it("SC-14 totalHits caps each category at three and counts owned ones as full", () => {
    expect(totalHits([], {})).toBe(0);
    expect(totalHits(["geografia"], { historia: 2, arte: 9 })).toBe(8);
  });

  it("SC-15 isTurnLimitReached is true only when both players reach 30", () => {
    expect(isTurnLimitReached([30, 29])).toBe(false);
    expect(isTurnLimitReached([29, 30])).toBe(false);
    expect(isTurnLimitReached([30, 30])).toBe(true);
    expect(isTurnLimitReached([20, 20])).toBe(false);
    expect(isTurnLimitReached([0, 0])).toBe(false);
  });

  it("SC-16 computeCategoryWin returns the exact winner shape", () => {
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
  });

  it("SC-17 isSixCategoriesResult distinguishes the crowns result from both rounds results", () => {
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

  it("SC-18 applySixCategoriesAnswer does not mutate its input", () => {
    const input = deepFreeze(
      sixState({
        ownedCategories: owners([...five], ["historia"]),
        categoryHits: [{ deportes: 2 }, { arte: 1 }],
        turnsPlayed: [19, 19],
        category: "deportes",
      }),
    );
    const snapshot = JSON.stringify(input);
    const outcome = applySixCategoriesAnswer(input);
    expect(outcome.result).toMatchObject({ kind: "winner", winnerIndex: 0 });
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("SC-19 only the acting player's turns and hits change", () => {
    const firstWrong = applySixCategoriesAnswer(
      sixState({ currentPlayer: 0, correct: false }),
    );
    expect(firstWrong.turnsPlayed).toStrictEqual([1, 0]);

    const secondRight = applySixCategoriesAnswer(
      sixState({
        turnsPlayed: firstWrong.turnsPlayed as TurnsPlayed,
        categoryHits: firstWrong.categoryHits,
        currentPlayer: 1,
        category: "arte",
      }),
    );
    expect(secondRight.turnsPlayed).toStrictEqual([1, 0]);
    expect(secondRight.categoryHits).toStrictEqual([{}, { arte: 1 }]);
  });

  it("SC-20 at the limit either player can win on crowns or on hits", () => {
    expect(
      computeTurnLimitResult(owners(["geografia"], ["arte", "ciencia"])),
    ).toMatchObject({ kind: "winner", winnerIndex: 1, reason: "turn-limit" });
    expect(
      computeTurnLimitResult(owners(["geografia"], ["arte"]), [
        { historia: 2 },
        { ciencia: 1 },
      ]),
    ).toStrictEqual({
      mode: "six-categories",
      kind: "winner",
      winnerIndex: 0,
      categories: [1, 1],
      reason: "turn-limit",
      hits: [5, 4],
    });
  });
});
