import { describe, expect, it } from "vitest";
import {
  ADMIN_EXPIRED_KEY_MESSAGE,
  ADMIN_MISSING_KEY_MESSAGE,
  getAdminFailure,
} from "./adminFailures";
import { ApiError } from "./errors";

describe("getAdminFailure", () => {
  it("ERR-01 maps network to a retryable API question", () => {
    expect(
      getAdminFailure(new ApiError("network", "Error de conexión.")),
    ).toEqual({
      kind: "error",
      message: "¿Está corriendo la API?",
      retryable: true,
    });
  });

  it("ERR-02 maps timeout to the same copy", () => {
    expect(
      getAdminFailure(new ApiError("timeout", "La solicitud tardó demasiado.")),
    ).toEqual({
      kind: "error",
      message: "¿Está corriendo la API?",
      retryable: true,
    });
  });

  it("ERR-03 maps 401 to unauthorized with the expired-key message and no retry", () => {
    expect(
      getAdminFailure(
        new ApiError("http", "Error en la solicitud.", { status: 401 }),
      ),
    ).toEqual({
      kind: "unauthorized",
      message: "La clave dejó de ser válida. Volvé a ingresar la clave.",
      retryable: false,
    });
  });

  it("ERR-04 maps 503 to the missing-key message and retryable", () => {
    expect(
      getAdminFailure(
        new ApiError("http", "Error del servidor.", { status: 503 }),
      ),
    ).toEqual({
      kind: "error",
      message: "La API no tiene la clave de administración configurada.",
      retryable: true,
    });
  });

  it("ERR-05 maps 404 to the report-gone copy without retry", () => {
    expect(
      getAdminFailure(
        new ApiError("http", "Recurso no encontrado.", { status: 404 }),
      ),
    ).toEqual({
      kind: "error",
      message: "El reporte ya no existe.",
      retryable: false,
    });
  });

  it("ERR-06 maps 422 with and without detail", () => {
    const withDetail = getAdminFailure(
      new ApiError("http", "Los datos enviados no son válidos.", {
        status: 422,
        detail: "estado inválido",
      }),
    );
    expect(withDetail).toEqual({
      kind: "error",
      message: "El cambio de estado no es válido.",
      detail: "estado inválido",
      retryable: false,
    });

    const withoutDetail = getAdminFailure(
      new ApiError("http", "Los datos enviados no son válidos.", {
        status: 422,
      }),
    );
    expect(withoutDetail).toEqual({
      kind: "error",
      message: "El cambio de estado no es válido.",
      retryable: false,
    });
    expect("detail" in withoutDetail).toBe(false);
  });

  it("ERR-07 maps 5xx to its message with no detail and retryable", () => {
    const failure = getAdminFailure(
      new ApiError("http", "Error del servidor.", {
        status: 500,
        detail: "boom",
      }),
    );
    expect(failure).toEqual({
      kind: "error",
      message: "Error del servidor.",
      retryable: true,
    });
    expect("detail" in failure).toBe(false);
  });

  it("ERR-08 maps another 4xx to its message without retry", () => {
    const failure = getAdminFailure(
      new ApiError("http", "Error en la solicitud.", {
        status: 403,
        detail: "forbidden",
      }),
    );
    expect(failure).toEqual({
      kind: "error",
      message: "Error en la solicitud.",
      retryable: false,
    });
    expect("detail" in failure).toBe(false);
  });

  it("ERR-08b maps an HTTP error without status to a non-retryable error", () => {
    expect(
      getAdminFailure(new ApiError("http", "Error en la solicitud.")),
    ).toEqual({
      kind: "error",
      message: "Error en la solicitud.",
      retryable: false,
    });
  });

  it("ERR-09 passes a validation error's message and detail through", () => {
    expect(
      getAdminFailure(
        new ApiError("validation", "Respuesta inválida del servidor.", {
          detail: "contador de pendientes inválido",
        }),
      ),
    ).toEqual({
      kind: "error",
      message: "Respuesta inválida del servidor.",
      detail: "contador de pendientes inválido",
      retryable: false,
    });

    const withoutDetail = getAdminFailure(
      new ApiError("validation", "Escribí un comentario para el motivo Otro."),
    );
    expect(withoutDetail).toEqual({
      kind: "error",
      message: "Escribí un comentario para el motivo Otro.",
      retryable: false,
    });
    expect("detail" in withoutDetail).toBe(false);
  });

  it("ERR-10 the two messages are the exact constants", () => {
    expect(ADMIN_EXPIRED_KEY_MESSAGE).toBe(
      "La clave dejó de ser válida. Volvé a ingresar la clave.",
    );
    expect(ADMIN_MISSING_KEY_MESSAGE).toBe(
      "La API no tiene la clave de administración configurada.",
    );
  });
});
