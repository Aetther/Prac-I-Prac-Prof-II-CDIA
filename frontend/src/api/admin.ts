import { apiRequest } from "./client";
import { ApiError } from "./errors";
import type {
  AdminReport,
  AdminReportStatusFilter,
  ReportStats,
  ReportStatus,
} from "./types";
import {
  isReportStatus,
  validateAdminReport,
  validateAdminReportList,
  validateReportStats,
} from "./validation";

export const ADMIN_REPORT_PAGE_SIZE = 20;

export interface ReportListParams {
  status: AdminReportStatusFilter;
  questionId?: number | null;
  skip: number;
  limit: number;
}

export const ADMIN_STATUS_LABELS: Record<ReportStatus, string> = {
  pendiente: "Pendiente",
  resuelto: "Resuelto",
  descartado: "Descartado",
};

export const ADMIN_STATUS_FILTER_OPTIONS: readonly {
  value: AdminReportStatusFilter;
  label: string;
}[] = [
  { value: "pendiente", label: "Pendientes" },
  { value: "resuelto", label: "Resueltos" },
  { value: "descartado", label: "Descartados" },
  { value: "todos", label: "Todos" },
];

export const ADMIN_REPORT_LANG_LABELS: Record<"es" | "en", string> = {
  es: "Español",
  en: "English",
};

function requireKey(apiKey: unknown): asserts apiKey is string {
  if (typeof apiKey !== "string" || apiKey === "") {
    throw new ApiError(
      "validation",
      "La clave de administración es obligatoria.",
    );
  }
}

function isQuestionId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export async function getReportStats(apiKey: string): Promise<ReportStats> {
  requireKey(apiKey);

  const data = await apiRequest<unknown>("/reports/stats", {
    method: "GET",
    headers: { "X-API-Key": apiKey },
  });
  return validateReportStats(data);
}

export async function getReports(
  apiKey: string,
  params: ReportListParams,
): Promise<AdminReport[]> {
  requireKey(apiKey);
  const { status, questionId, skip, limit } = params;
  if (status !== "todos" && !isReportStatus(status)) {
    throw new ApiError("validation", "El filtro de estado no es válido.");
  }
  if (
    questionId !== null &&
    questionId !== undefined &&
    !isQuestionId(questionId)
  ) {
    throw new ApiError("validation", "El id de la pregunta no es válido.");
  }
  if (typeof skip !== "number" || !Number.isInteger(skip) || skip < 0) {
    throw new ApiError("validation", "La página de reportes no es válida.");
  }
  if (
    typeof limit !== "number" ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    throw new ApiError("validation", "El tamaño de página no es válido.");
  }

  const query = new URLSearchParams();
  query.set("status", status);
  query.set("skip", String(skip));
  query.set("limit", String(limit));
  if (questionId !== null && questionId !== undefined) {
    query.set("question_id", String(questionId));
  }

  const data = await apiRequest<unknown>(`/reports?${query.toString()}`, {
    method: "GET",
    headers: { "X-API-Key": apiKey },
  });
  return validateAdminReportList(data);
}

export async function updateReportStatus(
  apiKey: string,
  reportId: number,
  status: ReportStatus,
): Promise<AdminReport> {
  requireKey(apiKey);
  if (
    typeof reportId !== "number" ||
    !Number.isInteger(reportId) ||
    reportId <= 0
  ) {
    throw new ApiError("validation", "El reporte no es válido.");
  }
  if (!isReportStatus(status)) {
    throw new ApiError("validation", "El estado del reporte no es válido.");
  }

  const data = await apiRequest<unknown>(`/reports/${reportId}`, {
    method: "PATCH",
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });
  return validateAdminReport(data);
}
