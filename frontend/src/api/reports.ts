import { apiRequest } from "./client";
import { ApiError } from "./errors";
import {
  isReportReason,
  MAX_REPORT_COMMENT_LENGTH,
  normalizeReportComment,
} from "./reportReasons";
import type { ReportQuestionResult, ReportReason } from "./types";
import { validateReportQuestionResult } from "./validation";

interface ReportBody {
  question_id: number;
  reason: ReportReason;
  comment?: string;
  lang: "es" | "en";
}

export async function reportQuestion(
  questionId: number,
  reason: ReportReason,
  comment: string | null,
  lang: "es" | "en",
): Promise<ReportQuestionResult> {
  if (
    typeof questionId !== "number" ||
    !Number.isInteger(questionId) ||
    questionId <= 0
  ) {
    throw new ApiError("validation", "La pregunta del reporte no es válida.");
  }
  if (!isReportReason(reason)) {
    throw new ApiError("validation", "El motivo del reporte no es válido.");
  }
  if (lang !== "es" && lang !== "en") {
    throw new ApiError("validation", "El idioma del reporte no es válido.");
  }
  if (comment !== null && typeof comment !== "string") {
    throw new ApiError("validation", "El comentario del reporte no es válido.");
  }
  const rawComment = comment ?? "";
  if (rawComment.length > MAX_REPORT_COMMENT_LENGTH) {
    throw new ApiError(
      "validation",
      "El comentario no puede superar los 500 caracteres.",
    );
  }
  const normalizedComment = normalizeReportComment(rawComment);
  if (reason === "otro" && normalizedComment === "") {
    throw new ApiError(
      "validation",
      "Escribí un comentario para el motivo Otro.",
    );
  }

  const body: ReportBody = {
    question_id: questionId,
    reason,
    lang,
  };
  if (normalizedComment !== "") {
    body.comment = normalizedComment;
  }

  const data = await apiRequest<unknown>("/reports", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return validateReportQuestionResult(data);
}
