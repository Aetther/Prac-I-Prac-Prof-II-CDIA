import type { ApiError } from "../api/errors";

export function getApiErrorMessage(error: ApiError): string {
  if (error.kind === "network" || error.kind === "timeout") {
    return "¿Está corriendo la API?";
  }
  return error.message;
}
