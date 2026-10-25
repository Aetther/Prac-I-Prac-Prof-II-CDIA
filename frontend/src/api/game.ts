import { apiRequest } from "./client";
import {
  validateCategories,
  validateGameQuestion,
  validateSubmitAnswer,
} from "./validation";
import type { Category, GameQuestion, SubmitAnswerResult } from "./types";
import { ApiError } from "./errors";

export async function getCategories(): Promise<Category[]> {
  const data = await apiRequest<unknown>("/categories");
  return validateCategories(data);
}

export async function getGameQuestion(
  category: string,
  lang: "es" | "en",
): Promise<GameQuestion> {
  const data = await apiRequest<unknown>(
    `/game/question?category=${encodeURIComponent(category)}&lang=${encodeURIComponent(lang)}`,
  );
  return validateGameQuestion(data);
}

export async function submitAnswer(
  questionId: number,
  answer: string,
  lang: "es" | "en",
): Promise<SubmitAnswerResult> {
  if (typeof answer !== "string" || answer === "" || answer.length > 300) {
    throw new ApiError("validation", "La respuesta no es válida.");
  }
  const data = await apiRequest<unknown>(
    `/game/answer?lang=${encodeURIComponent(lang)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question_id: questionId,
        answer,
      }),
    },
  );
  return validateSubmitAnswer(data);
}
