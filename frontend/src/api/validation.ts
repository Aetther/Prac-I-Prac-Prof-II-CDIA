import { ApiError } from "./errors";
import { isReportReason } from "./reportReasons";
import type {
  AdminReport,
  Category,
  GameQuestion,
  ReportQuestionResult,
  ReportStats,
  ReportStatus,
  SubmitAnswerResult,
} from "./types";

export const REPORT_STATUSES: readonly ReportStatus[] = [
  "pendiente",
  "resuelto",
  "descartado",
];

export function isReportStatus(value: unknown): value is ReportStatus {
  return (
    typeof value === "string" &&
    (REPORT_STATUSES as readonly string[]).includes(value)
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function invalid(detail: string): ApiError {
  return new ApiError("validation", "Respuesta inválida del servidor.", {
    detail,
  });
}

export function validateCategories(data: unknown): Category[] {
  if (!Array.isArray(data)) {
    throw new ApiError("validation", "Respuesta inválida del servidor.", {
      detail: "categories debe ser un array",
    });
  }
  if (data.length !== 6) {
    throw new ApiError("validation", "Respuesta inválida del servidor.", {
      detail: "se esperan exactamente 6 categorías",
    });
  }
  for (const item of data) {
    if (typeof item !== "object" || item === null) {
      throw new ApiError("validation", "Respuesta inválida del servidor.", {
        detail: "categoría inválida",
      });
    }
    const cat = item as Record<string, unknown>;
    if (typeof cat.name !== "string" || cat.name === "") {
      throw new ApiError("validation", "Respuesta inválida del servidor.", {
        detail: "nombre de categoría inválido",
      });
    }
    if (typeof cat.label !== "string" || cat.label === "") {
      throw new ApiError("validation", "Respuesta inválida del servidor.", {
        detail: "etiqueta de categoría inválida",
      });
    }
    if (typeof cat.description !== "string" || cat.description === "") {
      throw new ApiError("validation", "Respuesta inválida del servidor.", {
        detail: "descripción de categoría inválida",
      });
    }
  }
  return data as Category[];
}

export function validateGameQuestion(data: unknown): GameQuestion {
  if (typeof data !== "object" || data === null) {
    throw new ApiError("validation", "Respuesta inválida del servidor.", {
      detail: "pregunta inválida",
    });
  }
  const q = data as Record<string, unknown>;
  if (typeof q.id !== "number" || !Number.isInteger(q.id) || q.id <= 0) {
    throw new ApiError("validation", "Respuesta inválida del servidor.", {
      detail: "id de pregunta inválido",
    });
  }
  if (typeof q.question !== "string" || q.question === "") {
    throw new ApiError("validation", "Respuesta inválida del servidor.", {
      detail: "texto de pregunta inválido",
    });
  }
  if (typeof q.category !== "string" || q.category === "") {
    throw new ApiError("validation", "Respuesta inválida del servidor.", {
      detail: "categoría inválida",
    });
  }
  if (!Array.isArray(q.options) || q.options.length !== 4) {
    throw new ApiError("validation", "Respuesta inválida del servidor.", {
      detail: "opciones inválidas",
    });
  }
  for (const opt of q.options) {
    if (typeof opt !== "string" || opt === "") {
      throw new ApiError("validation", "Respuesta inválida del servidor.", {
        detail: "opción inválida",
      });
    }
  }
  if (q.lang !== "es" && q.lang !== "en") {
    throw new ApiError("validation", "Respuesta inválida del servidor.", {
      detail: "idioma inválido",
    });
  }
  return data as GameQuestion;
}

export function validateSubmitAnswer(data: unknown): SubmitAnswerResult {
  if (typeof data !== "object" || data === null) {
    throw new ApiError("validation", "Respuesta inválida del servidor.", {
      detail: "respuesta inválida",
    });
  }
  const res = data as Record<string, unknown>;
  if (typeof res.correct !== "boolean") {
    throw new ApiError("validation", "Respuesta inválida del servidor.", {
      detail: "campo correct inválido",
    });
  }
  if (typeof res.correct_answer !== "string") {
    throw new ApiError("validation", "Respuesta inválida del servidor.", {
      detail: "respuesta correcta inválida",
    });
  }
  return data as SubmitAnswerResult;
}

export function validateReportQuestionResult(
  data: unknown,
): ReportQuestionResult {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new ApiError("validation", "Respuesta inválida del servidor.", {
      detail: "reporte inválido",
    });
  }
  const report = data as Record<string, unknown>;
  if (
    typeof report.id !== "number" ||
    !Number.isInteger(report.id) ||
    report.id <= 0
  ) {
    throw new ApiError("validation", "Respuesta inválida del servidor.", {
      detail: "id de reporte inválido",
    });
  }
  if (
    typeof report.question_id !== "number" ||
    !Number.isInteger(report.question_id) ||
    report.question_id <= 0
  ) {
    throw new ApiError("validation", "Respuesta inválida del servidor.", {
      detail: "question_id inválido",
    });
  }
  if (!isReportReason(report.reason)) {
    throw new ApiError("validation", "Respuesta inválida del servidor.", {
      detail: "motivo de reporte inválido",
    });
  }
  if (!isReportStatus(report.status)) {
    throw new ApiError("validation", "Respuesta inválida del servidor.", {
      detail: "estado de reporte inválido",
    });
  }
  if (typeof report.created_at !== "string" || report.created_at === "") {
    throw new ApiError("validation", "Respuesta inválida del servidor.", {
      detail: "fecha de creación inválida",
    });
  }
  return data as ReportQuestionResult;
}

export function validateReportStats(data: unknown): ReportStats {
  if (!isPlainObject(data)) {
    throw invalid("estadísticas inválidas");
  }
  if (!isCount(data.pendiente)) {
    throw invalid("contador de pendientes inválido");
  }
  if (!isCount(data.resuelto)) {
    throw invalid("contador de resueltos inválido");
  }
  if (!isCount(data.descartado)) {
    throw invalid("contador de descartados inválido");
  }
  if (!isPlainObject(data.pending_by_reason)) {
    throw invalid("desglose por motivo inválido");
  }
  for (const value of Object.values(data.pending_by_reason)) {
    if (!isCount(value)) {
      throw invalid("contador por motivo inválido");
    }
  }
  return data as unknown as ReportStats;
}

export function validateAdminReport(data: unknown): AdminReport {
  if (!isPlainObject(data)) {
    throw invalid("reporte inválido");
  }
  if (
    typeof data.id !== "number" ||
    !Number.isInteger(data.id) ||
    data.id <= 0
  ) {
    throw invalid("id de reporte inválido");
  }
  if (
    typeof data.question_id !== "number" ||
    !Number.isInteger(data.question_id) ||
    data.question_id <= 0
  ) {
    throw invalid("question_id inválido");
  }
  if (!isReportReason(data.reason)) {
    throw invalid("motivo de reporte inválido");
  }
  if (data.comment !== null && typeof data.comment !== "string") {
    throw invalid("comentario de reporte inválido");
  }
  if (data.lang !== "es" && data.lang !== "en") {
    throw invalid("idioma del reporte inválido");
  }
  if (!isReportStatus(data.status)) {
    throw invalid("estado de reporte inválido");
  }
  if (typeof data.created_at !== "string" || data.created_at === "") {
    throw invalid("fecha de creación inválida");
  }
  if (
    data.resolved_at !== null &&
    (typeof data.resolved_at !== "string" || data.resolved_at === "")
  ) {
    throw invalid("fecha de resolución inválida");
  }
  if (!isPlainObject(data.question)) {
    throw invalid("pregunta del reporte inválida");
  }
  const question = data.question;
  if (typeof question.question !== "string" || question.question === "") {
    throw invalid("texto de pregunta inválido");
  }
  if (typeof question.answer !== "string" || question.answer === "") {
    throw invalid("respuesta de la pregunta inválida");
  }
  if (
    question.question_es !== null &&
    typeof question.question_es !== "string"
  ) {
    throw invalid("texto de pregunta en español inválido");
  }
  if (question.answer_es !== null && typeof question.answer_es !== "string") {
    throw invalid("respuesta en español inválida");
  }
  if (typeof question.is_translated !== "boolean") {
    throw invalid("indicador de traducción inválido");
  }
  if (typeof question.is_active !== "boolean") {
    throw invalid("indicador de publicación inválido");
  }
  return data as unknown as AdminReport;
}

export function validateAdminReportList(data: unknown): AdminReport[] {
  if (!Array.isArray(data)) {
    throw invalid("lista de reportes inválida");
  }
  return data.map((item) => validateAdminReport(item));
}
