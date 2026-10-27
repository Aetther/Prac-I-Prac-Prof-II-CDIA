import { describe, expect, it } from "vitest";
import { ApiError } from "./errors";
import {
  validateCategories,
  validateGameQuestion,
  validateReportQuestionResult,
  validateSubmitAnswer,
} from "./validation";

describe("validation coverage", () => {
  it("validateCategories - not array", () => {
    expect(() => validateCategories({} as unknown)).toThrow(ApiError);
  });
  it("validateCategories - wrong length", () => {
    expect(() => validateCategories([] as unknown)).toThrow(ApiError);
  });
  it("validateCategories - item not object", () => {
    const arr = Array(6)
      .fill(null)
      .map((_, i) =>
        i === 0 ? null : { name: "n", label: "l", description: "d" },
      );
    expect(() => validateCategories(arr as unknown)).toThrow(ApiError);
  });
  it("validateCategories - name empty or not string", () => {
    const arr1 = Array(6).fill({ name: "", label: "l", description: "d" });
    expect(() => validateCategories(arr1 as unknown)).toThrow(ApiError);
    const arr2 = Array(6).fill({ name: 123, label: "l", description: "d" });
    expect(() => validateCategories(arr2 as unknown)).toThrow(ApiError);
  });
  it("validateCategories - label empty or not string", () => {
    const arr1 = Array(6).fill({ name: "n", label: "", description: "d" });
    expect(() => validateCategories(arr1 as unknown)).toThrow(ApiError);
    const arr2 = Array(6).fill({ name: "n", label: null, description: "d" });
    expect(() => validateCategories(arr2 as unknown)).toThrow(ApiError);
  });
  it("validateCategories - description empty or not string", () => {
    const arr1 = Array(6).fill({ name: "n", label: "l", description: "" });
    expect(() => validateCategories(arr1 as unknown)).toThrow(ApiError);
    const arr2 = Array(6).fill({
      name: "n",
      label: "l",
      description: undefined,
    });
    expect(() => validateCategories(arr2 as unknown)).toThrow(ApiError);
  });
  it("validateCategories - valid", () => {
    const arr = Array(6)
      .fill(0)
      .map((_, i) => ({ name: `n${i}`, label: `l${i}`, description: `d${i}` }));
    const res = validateCategories(arr);
    expect(res).toHaveLength(6);
  });

  it("validateGameQuestion - not object", () => {
    expect(() => validateGameQuestion(null)).toThrow(ApiError);
    expect(() => validateGameQuestion([])).toThrow(ApiError);
  });
  it("validateGameQuestion - id invalid", () => {
    const base = {
      id: 1,
      question: "q",
      category: "c",
      options: ["a", "b", "c", "d"],
      lang: "es",
    };
    expect(() => validateGameQuestion({ ...base, id: 0 })).toThrow(ApiError);
    expect(() => validateGameQuestion({ ...base, id: 1.5 })).toThrow(ApiError);
    expect(() => validateGameQuestion({ ...base, id: "1" })).toThrow(ApiError);
  });
  it("validateGameQuestion - question invalid", () => {
    const base = {
      id: 1,
      question: "q",
      category: "c",
      options: ["a", "b", "c", "d"],
      lang: "es",
    };
    expect(() => validateGameQuestion({ ...base, question: "" })).toThrow(
      ApiError,
    );
    expect(() => validateGameQuestion({ ...base, question: 123 })).toThrow(
      ApiError,
    );
  });
  it("validateGameQuestion - category invalid", () => {
    const base = {
      id: 1,
      question: "q",
      category: "c",
      options: ["a", "b", "c", "d"],
      lang: "es",
    };
    expect(() => validateGameQuestion({ ...base, category: "" })).toThrow(
      ApiError,
    );
    expect(() => validateGameQuestion({ ...base, category: null })).toThrow(
      ApiError,
    );
  });
  it("validateGameQuestion - options invalid", () => {
    const base = {
      id: 1,
      question: "q",
      category: "c",
      options: ["a", "b", "c", "d"],
      lang: "es",
    };
    expect(() => validateGameQuestion({ ...base, options: [] })).toThrow(
      ApiError,
    );
    expect(() =>
      validateGameQuestion({ ...base, options: ["a", "b", "c"] }),
    ).toThrow(ApiError);
    expect(() =>
      validateGameQuestion({ ...base, options: ["a", "b", "c", ""] }),
    ).toThrow(ApiError);
    expect(() =>
      validateGameQuestion({ ...base, options: ["a", "b", "c", 123] }),
    ).toThrow(ApiError);
  });
  it("validateGameQuestion - lang invalid", () => {
    const base = {
      id: 1,
      question: "q",
      category: "c",
      options: ["a", "b", "c", "d"],
      lang: "es",
    };
    expect(() => validateGameQuestion({ ...base, lang: "fr" })).toThrow(
      ApiError,
    );
  });
  it("validateGameQuestion - valid en", () => {
    const q = {
      id: 2,
      question: "q",
      category: "c",
      options: ["a", "b", "c", "d"],
      lang: "en",
    };
    const res = validateGameQuestion(q);
    expect(res.lang).toBe("en");
  });

  it("validateSubmitAnswer - not object", () => {
    expect(() => validateSubmitAnswer(null)).toThrow(ApiError);
    expect(() => validateSubmitAnswer("x")).toThrow(ApiError);
  });
  it("validateSubmitAnswer - correct invalid", () => {
    expect(() =>
      validateSubmitAnswer({ correct: "true", correct_answer: "A" }),
    ).toThrow(ApiError);
  });
  it("validateSubmitAnswer - correct_answer invalid", () => {
    expect(() =>
      validateSubmitAnswer({ correct: true, correct_answer: 123 }),
    ).toThrow(ApiError);
  });
  it("validateSubmitAnswer - valid", () => {
    const res = validateSubmitAnswer({ correct: false, correct_answer: "C" });
    expect(res.correct).toBe(false);
  });

  const report = {
    id: 7,
    question_id: 42,
    reason: "traduccion",
    status: "pendiente",
    created_at: "2026-10-26T12:00:00Z",
  };

  it("validateReportQuestionResult - not an object", () => {
    expect(() => validateReportQuestionResult(null)).toThrow(ApiError);
    expect(() => validateReportQuestionResult("x")).toThrow(ApiError);
  });

  it("validateReportQuestionResult - invalid id", () => {
    expect(() => validateReportQuestionResult({ ...report, id: 0 })).toThrow(
      ApiError,
    );
    expect(() => validateReportQuestionResult({ ...report, id: 1.5 })).toThrow(
      ApiError,
    );
    expect(() => validateReportQuestionResult({ ...report, id: "7" })).toThrow(
      ApiError,
    );
  });

  it("validateReportQuestionResult - invalid question_id", () => {
    expect(() =>
      validateReportQuestionResult({ ...report, question_id: 0 }),
    ).toThrow(ApiError);
    expect(() =>
      validateReportQuestionResult({ ...report, question_id: 1.5 }),
    ).toThrow(ApiError);
    expect(() =>
      validateReportQuestionResult({ ...report, question_id: null }),
    ).toThrow(ApiError);
  });

  it("validateReportQuestionResult - invalid reason", () => {
    expect(() =>
      validateReportQuestionResult({ ...report, reason: "foo" }),
    ).toThrow(ApiError);
    expect(() =>
      validateReportQuestionResult({ ...report, reason: 7 }),
    ).toThrow(ApiError);
  });

  it("validateReportQuestionResult - invalid status", () => {
    for (const status of ["", "pending", 7, undefined]) {
      expect(() => validateReportQuestionResult({ ...report, status })).toThrow(
        ApiError,
      );
    }
  });

  it("validateReportQuestionResult - invalid created_at", () => {
    expect(() =>
      validateReportQuestionResult({ ...report, created_at: "" }),
    ).toThrow(ApiError);
    expect(() =>
      validateReportQuestionResult({ ...report, created_at: 7 }),
    ).toThrow(ApiError);
  });

  it("validateReportQuestionResult - accepts each valid status", () => {
    for (const status of ["pendiente", "resuelto", "descartado"]) {
      expect(validateReportQuestionResult({ ...report, status }).status).toBe(
        status,
      );
    }
  });
});
