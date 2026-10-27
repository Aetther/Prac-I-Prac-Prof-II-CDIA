import type { ReportReason } from "./types";

export const REPORT_REASONS: readonly ReportReason[] = [
  "traduccion",
  "respuesta_incorrecta",
  "error_texto",
  "otro",
];

export const MAX_REPORT_COMMENT_LENGTH = 500;

export function isReportReason(value: unknown): value is ReportReason {
  return (
    typeof value === "string" &&
    (REPORT_REASONS as readonly string[]).includes(value)
  );
}

export function normalizeReportComment(comment: string): string {
  return comment.trim();
}
