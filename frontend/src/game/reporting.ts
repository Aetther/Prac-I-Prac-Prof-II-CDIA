import type { ApiError } from "../api/errors";
import {
  MAX_REPORT_COMMENT_LENGTH,
  normalizeReportComment,
} from "../api/reportReasons";
import type { ReportReason } from "../api/types";

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  traduccion: "Traducción",
  respuesta_incorrecta: "Respuesta incorrecta",
  error_texto: "Error en el texto",
  otro: "Otro",
};

export interface ReportFailure {
  readonly ok: false;
  readonly message: string;
  readonly detail?: string;
  readonly retryable: boolean;
  readonly unavailable: boolean;
}

export type ReportSubmissionResult = { readonly ok: true } | ReportFailure;

export function getReportCommentError(
  reason: ReportReason | null,
  raw: string,
): string | null {
  if (raw.length > MAX_REPORT_COMMENT_LENGTH) {
    return "El comentario no puede superar los 500 caracteres.";
  }
  if (reason === "otro" && normalizeReportComment(raw) === "") {
    return "Escribí un comentario para el motivo Otro.";
  }
  return null;
}

export function getReportFailure(error: ApiError): ReportFailure {
  if (error.kind === "network" || error.kind === "timeout") {
    return {
      ok: false,
      message: "¿Está corriendo la API?",
      retryable: true,
      unavailable: false,
    };
  }

  if (error.kind === "http") {
    if (error.status === 404) {
      return {
        ok: false,
        message: "La pregunta ya no está disponible.",
        retryable: false,
        unavailable: true,
      };
    }
    if (error.status === 422) {
      return {
        ok: false,
        message: "El reporte no es válido. Revisá el motivo y el comentario.",
        ...(error.detail !== undefined ? { detail: error.detail } : {}),
        retryable: false,
        unavailable: false,
      };
    }
    if (error.status === 429) {
      const seconds = error.retryAfterSeconds;
      let message: string;
      if (seconds === 1) {
        message = "Esperá 1 segundo";
      } else if (
        seconds !== undefined &&
        Number.isInteger(seconds) &&
        seconds >= 0
      ) {
        message = `Esperá ${seconds} segundos`;
      } else {
        message = "Demasiados reportes. Esperá un momento y volvé a intentar.";
      }
      return {
        ok: false,
        message,
        retryable: true,
        unavailable: false,
      };
    }
    return {
      ok: false,
      message: error.message,
      retryable: error.status !== undefined && error.status >= 500,
      unavailable: false,
    };
  }

  return {
    ok: false,
    message: error.message,
    ...(error.detail !== undefined ? { detail: error.detail } : {}),
    retryable: false,
    unavailable: false,
  };
}
