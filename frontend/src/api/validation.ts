import { ApiError } from "./errors";
import { isReportReason } from "./reportReasons";
import type {
  Category,
  GameQuestion,
  ReportQuestionResult,
  ReportStatus,
  SubmitAnswerResult,
} from "./types";

const REPORT_STATUSES: readonly ReportStatus[] = [
  "pendiente",
  "resuelto",
  "descartado",
];

function isReportStatus(value: unknown): value is ReportStatus {
  return (
    typeof value === "string" &&
    (REPORT_STATUSES as readonly string[]).includes(value)
  );
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
