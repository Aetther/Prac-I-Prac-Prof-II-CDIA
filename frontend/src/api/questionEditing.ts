import { apiRequest } from "./client";
import { ApiError } from "./errors";
import type {
  AdminQuestion,
  AdminQuestionEdit,
  AdminQuestionPatch,
  AdminQuestionTextField,
  AdminQuestionUpdateResult,
} from "./types";
import {
  validateAdminQuestion,
  validateAdminQuestionEdits,
  validateAdminQuestionUpdate,
  validateHiddenQuestion,
} from "./validation";

const TEXT_FIELD_LIMITS: Record<AdminQuestionTextField, number> = {
  question: 1000,
  answer: 300,
  wrong_1: 300,
  wrong_2: 300,
  wrong_3: 300,
  question_es: 1000,
  answer_es: 300,
  wrong_1_es: 300,
  wrong_2_es: 300,
  wrong_3_es: 300,
};

const PATCH_ERROR_MESSAGE = "El cambio de la pregunta no es válido.";

function requireQuestionKey(apiKey: unknown): asserts apiKey is string {
  if (typeof apiKey !== "string" || apiKey === "") {
    throw new ApiError(
      "validation",
      "La clave de administración es obligatoria.",
    );
  }
}

function requireQuestionId(questionId: unknown): asserts questionId is number {
  if (
    typeof questionId !== "number" ||
    !Number.isInteger(questionId) ||
    questionId <= 0
  ) {
    throw new ApiError("validation", "La pregunta no es válida.");
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTextField(key: string): key is AdminQuestionTextField {
  return Object.hasOwn(TEXT_FIELD_LIMITS, key);
}

function invalidPatch(): ApiError {
  return new ApiError("validation", PATCH_ERROR_MESSAGE);
}

function requirePatch(patch: unknown): AdminQuestionPatch {
  if (!isPlainObject(patch)) {
    throw invalidPatch();
  }
  const keys = Object.keys(patch);
  if (keys.length === 0) {
    throw invalidPatch();
  }
  for (const key of keys) {
    if (key !== "is_active" && !isTextField(key)) {
      throw invalidPatch();
    }
  }
  if ("is_active" in patch && patch.is_active !== true) {
    throw invalidPatch();
  }
  const trimmed: Record<string, string | true> = {};
  for (const key of keys) {
    if (key === "is_active") {
      trimmed[key] = true;
      continue;
    }
    const field = key as AdminQuestionTextField;
    const value = patch[key];
    if (typeof value !== "string") {
      throw invalidPatch();
    }
    const text = value.trim();
    if (text.length === 0 || text.length > TEXT_FIELD_LIMITS[field]) {
      throw invalidPatch();
    }
    trimmed[key] = text;
  }
  return trimmed as AdminQuestionPatch;
}

export async function getQuestion(
  apiKey: string,
  questionId: number,
): Promise<AdminQuestion> {
  requireQuestionKey(apiKey);
  requireQuestionId(questionId);

  const data = await apiRequest<unknown>(`/questions/${questionId}`, {
    method: "GET",
    headers: { "X-API-Key": apiKey },
  });
  return validateAdminQuestion(data);
}

export async function updateQuestion(
  apiKey: string,
  questionId: number,
  patch: AdminQuestionPatch,
): Promise<AdminQuestionUpdateResult> {
  requireQuestionKey(apiKey);
  requireQuestionId(questionId);
  const body = requirePatch(patch);

  const data = await apiRequest<unknown>(`/questions/${questionId}`, {
    method: "PATCH",
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return validateAdminQuestionUpdate(data);
}

export async function hideQuestion(
  apiKey: string,
  questionId: number,
): Promise<{ id: number; is_active: false }> {
  requireQuestionKey(apiKey);
  requireQuestionId(questionId);

  const data = await apiRequest<unknown>(`/questions/${questionId}`, {
    method: "DELETE",
    headers: { "X-API-Key": apiKey },
  });
  return validateHiddenQuestion(data);
}

export async function getQuestionEdits(
  apiKey: string,
  questionId: number,
): Promise<AdminQuestionEdit[]> {
  requireQuestionKey(apiKey);
  requireQuestionId(questionId);

  const data = await apiRequest<unknown>(`/questions/${questionId}/edits`, {
    method: "GET",
    headers: { "X-API-Key": apiKey },
  });
  return validateAdminQuestionEdits(data);
}
