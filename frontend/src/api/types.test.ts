import { describe, expect, it } from "vitest";
import type { Category, GameQuestion, SubmitAnswerResult } from "./types";

describe("api types", () => {
  it("types are valid", () => {
    const c: Category = { name: "x", label: "y", description: "z" };
    const q: GameQuestion = {
      id: 1,
      question: "q",
      category: "x",
      options: ["a", "b", "c", "d"],
      lang: "es",
    };
    const r: SubmitAnswerResult = { correct: true, correct_answer: "a" };
    expect(c.name).toBe("x");
    expect(q.options.length).toBe(4);
    expect(r.correct).toBe(true);
  });
});
