// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/errors";
import type { GameQuestion } from "../api/types";
import type { CategoryName } from "./types";
import { pickCategoryExcluding } from "./category";
import {
  DuplicateQuestionExhaustedError,
  fetchUnusedQuestion,
  isUntranslated,
  loadQuestionWithFallback,
} from "./question";

function question(
  id: number,
  overrides: Partial<GameQuestion> = {},
): GameQuestion {
  return {
    id,
    question: `Pregunta ${id}`,
    category: "geografia",
    options: ["Lima", "Quito", "Bogotá", "Buenos Aires"],
    lang: "es",
    ...overrides,
  };
}

function notFound(): ApiError {
  return new ApiError("http", "Recurso no encontrado.", { status: 404 });
}

const isQuestion404 = (error: unknown): boolean =>
  error instanceof ApiError && error.kind === "http" && error.status === 404;

const orderedPicker =
  (random: () => number = () => 0) =>
  (excluded: readonly CategoryName[]) =>
    pickCategoryExcluding(excluded, random);

describe("fetchUnusedQuestion", () => {
  it("returns the first unique question after one fetch", async () => {
    const fetcher = vi.fn().mockResolvedValue(question(42));
    const result = await fetchUnusedQuestion(fetcher, "geografia", "es", []);

    expect(result.id).toBe(42);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith("geografia", "es");
  });

  it("skips four repeated ids and returns the unique fifth question", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(question(7))
      .mockResolvedValueOnce(question(7))
      .mockResolvedValueOnce(question(7))
      .mockResolvedValueOnce(question(7))
      .mockResolvedValueOnce(question(8));

    const result = await fetchUnusedQuestion(fetcher, "geografia", "es", [7]);

    expect(result.id).toBe(8);
    expect(fetcher).toHaveBeenCalledTimes(5);
    expect(fetcher.mock.calls).toEqual([
      ["geografia", "es"],
      ["geografia", "es"],
      ["geografia", "es"],
      ["geografia", "es"],
      ["geografia", "es"],
    ]);
  });

  it("fails with the exact duplicate error after five repeated ids", async () => {
    const fetcher = vi.fn().mockResolvedValue(question(7));

    await expect(
      fetchUnusedQuestion(fetcher, "geografia", "es", [7]),
    ).rejects.toMatchObject({
      kind: "duplicate-exhausted",
      name: "DuplicateQuestionExhaustedError",
      message: "No encontramos una pregunta nueva.",
      category: "geografia",
    });
    expect(fetcher).toHaveBeenCalledTimes(5);
  });

  it("stops at the failing call and propagates the ApiError unchanged", async () => {
    const network = new ApiError(
      "network",
      "Error de conexión. Verificá que la API esté corriendo.",
      {},
    );
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(question(7))
      .mockRejectedValueOnce(network);

    await expect(
      fetchUnusedQuestion(fetcher, "geografia", "es", [7]),
    ).rejects.toMatchObject({
      kind: "network",
      message: "Error de conexión. Verificá que la API esté corriendo.",
      status: undefined,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe("isUntranslated", () => {
  it("detects untranslated only for Spanish requested and English returned", () => {
    expect(isUntranslated("es", "en")).toBe(true);
    expect(isUntranslated("es", "es")).toBe(false);
    expect(isUntranslated("en", "en")).toBe(false);
    expect(isUntranslated("en", "es")).toBe(false);
  });
});

describe("loadQuestionWithFallback", () => {
  it("returns the first question without a fallback call", async () => {
    const fetchUnique = vi.fn().mockResolvedValue(question(42));
    const pickNextCategory = vi.fn();

    const outcome = await loadQuestionWithFallback(
      fetchUnique,
      pickNextCategory,
      isQuestion404,
      { category: "geografia", attempted404: [] },
    );

    expect(outcome).toEqual({ kind: "loaded", question: question(42) });
    expect(fetchUnique).toHaveBeenCalledTimes(1);
    expect(pickNextCategory).not.toHaveBeenCalled();
  });

  it("re-rolls once after a 404 and records the excluded category", async () => {
    const fetchUnique = vi
      .fn()
      .mockRejectedValueOnce(notFound())
      .mockResolvedValueOnce(question(9));
    const pickNextCategory = vi.fn().mockReturnValue("historia");

    const outcome = await loadQuestionWithFallback(
      fetchUnique,
      pickNextCategory,
      isQuestion404,
      { category: "geografia", attempted404: [] },
    );

    expect(outcome).toEqual({ kind: "loaded", question: question(9) });
    expect(fetchUnique).toHaveBeenCalledTimes(2);
    expect(fetchUnique.mock.calls).toEqual([["geografia"], ["historia"]]);
    expect(pickNextCategory).toHaveBeenCalledWith(["geografia"]);
  });

  it("reports all six categories 404 after six calls in order", async () => {
    const fetchUnique = vi.fn().mockRejectedValue(notFound());

    const outcome = await loadQuestionWithFallback(
      fetchUnique,
      orderedPicker(),
      isQuestion404,
      { category: "geografia", attempted404: [] },
    );

    expect(outcome).toEqual({
      kind: "all-categories-404",
      attempted404: [
        "geografia",
        "historia",
        "ciencia",
        "arte",
        "entretenimiento",
        "deportes",
      ],
    });
    expect(fetchUnique).toHaveBeenCalledTimes(6);
    expect(fetchUnique.mock.calls).toEqual([
      ["geografia"],
      ["historia"],
      ["ciencia"],
      ["arte"],
      ["entretenimiento"],
      ["deportes"],
    ]);
  });

  it("returns the network error with the attempted category and set", async () => {
    const network = new ApiError(
      "network",
      "Error de conexión. Verificá que la API esté corriendo.",
      {},
    );
    const fetchUnique = vi.fn().mockRejectedValue(network);
    const pickNextCategory = vi.fn();

    const outcome = await loadQuestionWithFallback(
      fetchUnique,
      pickNextCategory,
      isQuestion404,
      { category: "geografia", attempted404: [] },
    );

    expect(outcome).toMatchObject({
      kind: "error",
      category: "geografia",
      attempted404: [],
    });
    expect(outcome.kind === "error" && outcome.error).toBe(network);
    expect(fetchUnique).toHaveBeenCalledTimes(1);
    expect(pickNextCategory).not.toHaveBeenCalled();
  });

  it("preserves the 404 set when a later category fails with a network error", async () => {
    const network = new ApiError(
      "network",
      "Error de conexión. Verificá que la API esté corriendo.",
      {},
    );
    const fetchUnique = vi.fn().mockRejectedValue(network);

    const outcome = await loadQuestionWithFallback(
      fetchUnique,
      vi.fn(),
      isQuestion404,
      { category: "historia", attempted404: ["geografia"] },
    );

    expect(outcome).toMatchObject({
      kind: "error",
      category: "historia",
      attempted404: ["geografia"],
    });
    expect(fetchUnique).toHaveBeenCalledTimes(1);
  });

  it("does not re-roll when the duplicate budget is exhausted", async () => {
    const duplicate = new DuplicateQuestionExhaustedError("geografia");
    const fetchUnique = vi.fn().mockRejectedValue(duplicate);
    const pickNextCategory = vi.fn();

    const outcome = await loadQuestionWithFallback(
      fetchUnique,
      pickNextCategory,
      isQuestion404,
      { category: "geografia", attempted404: [] },
    );

    expect(outcome).toMatchObject({ kind: "error" });
    expect(outcome.kind === "error" && outcome.error).toBe(duplicate);
    expect(pickNextCategory).not.toHaveBeenCalled();
    expect(fetchUnique).toHaveBeenCalledTimes(1);
  });

  it("adds the retried category to a pre-seeded 404 set and continues", async () => {
    const fetchUnique = vi
      .fn()
      .mockRejectedValueOnce(notFound())
      .mockResolvedValueOnce(question(11));
    const pickNextCategory = vi.fn().mockReturnValue("ciencia");

    const outcome = await loadQuestionWithFallback(
      fetchUnique,
      pickNextCategory,
      isQuestion404,
      { category: "geografia", attempted404: ["historia"] },
    );

    expect(outcome).toEqual({ kind: "loaded", question: question(11) });
    expect(fetchUnique).toHaveBeenCalledTimes(2);
    expect(pickNextCategory).toHaveBeenCalledWith(["historia", "geografia"]);
  });

  it("starts a fresh duplicate budget after a 404 that ended four duplicates", async () => {
    const getGameQuestion = vi
      .fn()
      .mockResolvedValueOnce(question(7))
      .mockResolvedValueOnce(question(8))
      .mockResolvedValueOnce(question(9))
      .mockResolvedValueOnce(question(10))
      .mockRejectedValueOnce(notFound())
      .mockResolvedValueOnce(question(11));
    const usedQuestionIds = [7, 8, 9, 10];
    const fetchUnique = (category: CategoryName) =>
      fetchUnusedQuestion(getGameQuestion, category, "es", usedQuestionIds);

    const outcome = await loadQuestionWithFallback(
      fetchUnique,
      orderedPicker(),
      isQuestion404,
      { category: "geografia", attempted404: [] },
    );

    expect(outcome).toMatchObject({
      kind: "loaded",
      question: { id: 11 },
    });
    expect(getGameQuestion).toHaveBeenCalledTimes(6);
    expect(getGameQuestion.mock.calls.map(([category]) => category)).toEqual([
      "geografia",
      "geografia",
      "geografia",
      "geografia",
      "geografia",
      "historia",
    ]);
  });
});
