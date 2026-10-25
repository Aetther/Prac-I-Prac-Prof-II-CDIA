import { ApiError } from "./errors";
import { buildUrl } from "./config";

const TIMEOUT_MS = 10000;

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError("timeout", "La solicitud tardó demasiado tiempo.", {});
    }
    throw new ApiError(
      "network",
      "Error de conexión. Verificá que la API esté corriendo.",
      {},
    );
  }
}

function normalizeErrorDetail(detail: unknown): string | undefined {
  if (detail === undefined || detail === null) {
    return undefined;
  }
  if (Array.isArray(detail)) {
    // Pydantic errors: [{loc, msg}, ...]
    const messages = detail
      .map((item) => {
        if (typeof item === "object" && item !== null && "msg" in item) {
          const msg = (item as { msg: unknown }).msg;
          return typeof msg === "string" ? msg : String(msg);
        }
        return String(item);
      })
      .filter((m) => m !== "");
    return messages.join(" ");
  }
  if (typeof detail === "string") {
    return detail;
  }
  return String(detail);
}

function getRetryAfterSeconds(response: Response): number | undefined {
  const retryAfter = response.headers.get("Retry-After");
  if (!retryAfter) return undefined;
  const seconds = parseInt(retryAfter, 10);
  if (Number.isNaN(seconds)) return undefined;
  return seconds;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = buildUrl(path);
  const response = await fetchWithTimeout(url, options);

  if (!response.ok) {
    let body: unknown;
    const rawText = await response.text().catch(() => "");
    if (rawText === "") {
      body = undefined;
    } else {
      try {
        body = JSON.parse(rawText);
      } catch {
        body = { detail: rawText };
      }
    }

    let detail: string | undefined;
    let message = "Error en la solicitud.";

    if (typeof body === "object" && body !== null && "detail" in body) {
      detail = normalizeErrorDetail((body as { detail: unknown }).detail);
    } else if (typeof body === "string") {
      detail = body;
    }

    if (response.status === 429) {
      const retryAfterSeconds = getRetryAfterSeconds(response);
      message = "Demasiadas solicitudes. Esperá unos segundos.";
      throw new ApiError("http", message, {
        status: response.status,
        detail,
        retryAfterSeconds,
      });
    } else if (response.status === 404) {
      message = "Recurso no encontrado.";
    } else if (response.status === 422) {
      message = "Los datos enviados no son válidos.";
    } else if (response.status >= 500) {
      message = "Error del servidor.";
    }

    throw new ApiError("http", message, {
      status: response.status,
      detail,
    });
  }

  try {
    const data = await response.json();
    return data as T;
  } catch {
    throw new ApiError("validation", "Respuesta inválida del servidor.", {
      detail: "no se pudo parsear JSON",
    });
  }
}
