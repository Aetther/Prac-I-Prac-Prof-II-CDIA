import { describe, expect, it } from "vitest";
import {
  ADMIN_EXPIRED_KEY_MESSAGE,
  ADMIN_MISSING_KEY_MESSAGE,
  getAdminFailure,
  getQuestionEditFailure,
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

describe("getQuestionEditFailure", () => {
  it("QERR-01 maps network and timeout to the retryable API question", () => {
    for (const kind of ["network", "timeout"] as const) {
      expect(
        getQuestionEditFailure(new ApiError(kind, "Sin conexión.")),
      ).toEqual({
        kind: "error",
        message: "¿Está corriendo la API?",
        retryable: true,
      });
    }
  });

  it("QERR-02 maps 401 to unauthorized with the expired-key message and no retry", () => {
    const failure = getQuestionEditFailure(
      new ApiError("http", "Error en la solicitud.", { status: 401 }),
    );
    expect(failure).toEqual({
      kind: "unauthorized",
      message: ADMIN_EXPIRED_KEY_MESSAGE,
      retryable: false,
    });
    expect("detail" in failure).toBe(false);
  });

  it("QERR-03 maps 503 to the missing-key message and retryable", () => {
    expect(
      getQuestionEditFailure(
        new ApiError("http", "Error del servidor.", { status: 503 }),
      ),
    ).toEqual({
      kind: "error",
      message: ADMIN_MISSING_KEY_MESSAGE,
      retryable: true,
    });
  });

  it("QERR-04 maps 404 to the question-gone copy without retry", () => {
    const failure = getQuestionEditFailure(
      new ApiError("http", "Recurso no encontrado.", { status: 404 }),
    );
    expect(failure).toEqual({
      kind: "error",
      message: "La pregunta ya no existe.",
      retryable: false,
    });
    expect("detail" in failure).toBe(false);
  });

  it("QERR-05 maps 422 with and without detail", () => {
    expect(
      getQuestionEditFailure(
        new ApiError("http", "Los datos enviados no son válidos.", {
          status: 422,
          detail: "las opciones deben ser distintas",
        }),
      ),
    ).toEqual({
      kind: "error",
      message: "El cambio no es válido.",
      detail: "las opciones deben ser distintas",
      retryable: false,
    });

    const withoutDetail = getQuestionEditFailure(
      new ApiError("http", "Los datos enviados no son válidos.", {
        status: 422,
      }),
    );
    expect(withoutDetail).toEqual({
      kind: "error",
      message: "El cambio no es válido.",
      retryable: false,
    });
    expect("detail" in withoutDetail).toBe(false);
  });

  it("QERR-06 maps 5xx to its message with no detail and retryable", () => {
    const failure = getQuestionEditFailure(
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

  it("QERR-07 maps another 4xx to its message without retry", () => {
    const failure = getQuestionEditFailure(
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

  it("QERR-08 passes a validation error's message and detail through", () => {
    expect(
      getQuestionEditFailure(
        new ApiError("validation", "Respuesta inválida del servidor.", {
          detail: "primera opción incorrecta inválida",
        }),
      ),
    ).toEqual({
      kind: "error",
      message: "Respuesta inválida del servidor.",
      detail: "primera opción incorrecta inválida",
      retryable: false,
    });

    const withoutDetail = getQuestionEditFailure(
      new ApiError("validation", "Respuesta inválida del servidor."),
    );
    expect(withoutDetail).toEqual({
      kind: "error",
      message: "Respuesta inválida del servidor.",
      retryable: false,
    });
    expect("detail" in withoutDetail).toBe(false);
  });

  it("QERR-09 the question mapper's 404 and 422 copy differs from getAdminFailure for the same ApiError", () => {
    const notFound = new ApiError("http", "Recurso no encontrado.", {
      status: 404,
    });
    expect(getQuestionEditFailure(notFound).message).toBe(
      "La pregunta ya no existe.",
    );
    expect(getAdminFailure(notFound).message).toBe("El reporte ya no existe.");

    const invalid = new ApiError("http", "Los datos enviados no son válidos.", {
      status: 422,
    });
    expect(getQuestionEditFailure(invalid).message).toBe(
      "El cambio no es válido.",
    );
    expect(getAdminFailure(invalid).message).toBe(
      "El cambio de estado no es válido.",
    );

    for (const error of [
      new ApiError("network", "Sin conexión."),
      new ApiError("http", "Error en la solicitud.", { status: 401 }),
      new ApiError("http", "Error del servidor.", { status: 503 }),
    ]) {
      expect(getQuestionEditFailure(error)).toEqual(getAdminFailure(error));
    }
  });

  it("QERR-10 the question mapper reuses the two exact constants", () => {
    expect(ADMIN_EXPIRED_KEY_MESSAGE).toBe(
      "La clave dejó de ser válida. Volvé a ingresar la clave.",
    );
    expect(ADMIN_MISSING_KEY_MESSAGE).toBe(
      "La API no tiene la clave de administración configurada.",
    );
    expect(
      getQuestionEditFailure(
        new ApiError("http", "Error en la solicitud.", { status: 401 }),
      ).message,
    ).toBe(ADMIN_EXPIRED_KEY_MESSAGE);
    expect(
      getQuestionEditFailure(
        new ApiError("http", "Error del servidor.", { status: 503 }),
      ).message,
    ).toBe(ADMIN_MISSING_KEY_MESSAGE);
  });
});
