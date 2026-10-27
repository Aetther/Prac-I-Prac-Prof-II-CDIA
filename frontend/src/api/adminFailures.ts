import type { ApiError } from "./errors";

export const ADMIN_EXPIRED_KEY_MESSAGE =
  "La clave dejó de ser válida. Volvé a ingresar la clave.";

export const ADMIN_MISSING_KEY_MESSAGE =
  "La API no tiene la clave de administración configurada.";

export interface AdminFailure {
  readonly kind: "unauthorized" | "error";
  readonly message: string;
  readonly detail?: string;
  readonly retryable: boolean;
}

export function getAdminFailure(error: ApiError): AdminFailure {
  if (error.kind === "network" || error.kind === "timeout") {
    return {
      kind: "error",
      message: "¿Está corriendo la API?",
      retryable: true,
    };
  }

  if (error.kind === "http") {
    if (error.status === 401) {
      return {
        kind: "unauthorized",
        message: ADMIN_EXPIRED_KEY_MESSAGE,
        retryable: false,
      };
    }
    if (error.status === 503) {
      return {
        kind: "error",
        message: ADMIN_MISSING_KEY_MESSAGE,
        retryable: true,
      };
    }
    if (error.status === 404) {
      return {
        kind: "error",
        message: "El reporte ya no existe.",
        retryable: false,
      };
    }
    if (error.status === 422) {
      return {
        kind: "error",
        message: "El cambio de estado no es válido.",
        ...(error.detail !== undefined ? { detail: error.detail } : {}),
        retryable: false,
      };
    }
    if (error.status !== undefined && error.status >= 500) {
      return {
        kind: "error",
        message: error.message,
        retryable: true,
      };
    }
    return {
      kind: "error",
      message: error.message,
      retryable: false,
    };
  }

  return {
    kind: "error",
    message: error.message,
    ...(error.detail !== undefined ? { detail: error.detail } : {}),
    retryable: false,
  };
}
