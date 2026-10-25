import type { GameQuestion } from "../api/types";
import type { CategoryName, Lang } from "./types";

export const MAX_QUESTION_ATTEMPTS = 5;
export const ALL_CATEGORIES_404_MESSAGE =
  "No hay preguntas disponibles en ninguna categoría.";

export type QuestionFetcher = (
  category: CategoryName,
  lang: Lang,
) => Promise<GameQuestion>;

export class DuplicateQuestionExhaustedError extends Error {
  readonly kind = "duplicate-exhausted" as const;
  readonly category: CategoryName;

  constructor(category: CategoryName) {
    super("No encontramos una pregunta nueva.");
    this.name = "DuplicateQuestionExhaustedError";
    this.category = category;
  }
}

export async function fetchUnusedQuestion(
  fetcher: QuestionFetcher,
  category: CategoryName,
  lang: Lang,
  usedQuestionIds: readonly number[],
): Promise<GameQuestion> {
  const used = new Set(usedQuestionIds);
  for (let attempt = 0; attempt < MAX_QUESTION_ATTEMPTS; attempt += 1) {
    const question = await fetcher(category, lang);
    if (!used.has(question.id)) {
      return question;
    }
  }
  throw new DuplicateQuestionExhaustedError(category);
}

export function isUntranslated(requested: Lang, actual: Lang): boolean {
  return requested === "es" && actual === "en";
}

export interface LoadQuestionContext {
  readonly category: CategoryName;
  readonly attempted404: readonly CategoryName[];
}

export type LoadQuestionOutcome =
  | { readonly kind: "loaded"; readonly question: GameQuestion }
  | {
      readonly kind: "error";
      readonly error: unknown;
      readonly category: CategoryName;
      readonly attempted404: readonly CategoryName[];
    }
  | {
      readonly kind: "all-categories-404";
      readonly attempted404: readonly CategoryName[];
    };

export async function loadQuestionWithFallback(
  fetchUnique: (category: CategoryName) => Promise<GameQuestion>,
  pickNextCategory: (excluded: readonly CategoryName[]) => CategoryName | null,
  isNotFound: (error: unknown) => boolean,
  context: LoadQuestionContext,
): Promise<LoadQuestionOutcome> {
  let category = context.category;
  let attempted404 = [...context.attempted404];
  for (;;) {
    try {
      return { kind: "loaded", question: await fetchUnique(category) };
    } catch (error) {
      if (isNotFound(error)) {
        attempted404 = [...attempted404, category];
        const next = pickNextCategory(attempted404);
        if (next === null) {
          return { kind: "all-categories-404", attempted404 };
        }
        category = next;
        continue;
      }
      return { kind: "error", error, category, attempted404 };
    }
  }
}
