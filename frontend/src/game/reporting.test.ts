// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ApiError } from "../api/errors";
import {
  REPORT_REASON_LABELS,
  getReportCommentError,
  getReportFailure,
} from "./reporting";

function failure(error: ApiError) {
  return getReportFailure(error);
}

describe("reporting copy", () => {
  it("labels the four reasons", () => {
    expect(REPORT_REASON_LABELS).toEqual({
      traduccion: "Traducción",
      respuesta_incorrecta: "Respuesta incorrecta",
      error_texto: "Error en el texto",
      otro: "Otro",
    });
  });

  it("maps network and timeout to a retryable API message", () => {
    expect(failure(new ApiError("network", "x"))).toMatchObject({
      ok: false,
      message: "¿Está corriendo la API?",
      retryable: true,
      unavailable: false,
    });
    expect(failure(new ApiError("timeout", "x"))).toMatchObject({
      ok: false,
      message: "¿Está corriendo la API?",
      retryable: true,
      unavailable: false,
    });
  });

  it("maps 404 to the unavailable message with no detail", () => {
    const result = failure(
      new ApiError("http", "Recurso no encontrado.", {
        status: 404,
        detail: "Question not found",
      }),
    );

    expect(result).toEqual({
      ok: false,
      message: "La pregunta ya no está disponible.",
      retryable: false,
      unavailable: true,
    });
    expect(result).not.toHaveProperty("detail");
  });

  it("maps 422 to the primary sentence plus its detail", () => {
    expect(
      failure(
        new ApiError("http", "Los datos enviados no son válidos.", {
          status: 422,
          detail: "comentario requerido",
        }),
      ),
    ).toEqual({
      ok: false,
      message: "El reporte no es válido. Revisá el motivo y el comentario.",
      detail: "comentario requerido",
      retryable: false,
      unavailable: false,
    });
  });

  it("maps 422 without a detail to the primary sentence only", () => {
    const result = failure(
      new ApiError("http", "Los datos enviados no son válidos.", {
        status: 422,
      }),
    );

    expect(result).toEqual({
      ok: false,
      message: "El reporte no es válido. Revisá el motivo y el comentario.",
      retryable: false,
      unavailable: false,
    });
    expect(result).not.toHaveProperty("detail");
  });

  it("uses the singular for Retry-After 1", () => {
    expect(
      failure(
        new ApiError("http", "Demasiadas solicitudes.", {
          status: 429,
          retryAfterSeconds: 1,
        }),
      ),
    ).toEqual({
      ok: false,
      message: "Esperá 1 segundo",
      retryable: true,
      unavailable: false,
    });
  });

  it.each([0, 7, 90])(
    "uses the plural for a non-negative integer Retry-After %i",
    (seconds) => {
      expect(
        failure(
          new ApiError("http", "Demasiadas solicitudes.", {
            status: 429,
            retryAfterSeconds: seconds,
          }),
        ).message,
      ).toBe(`Esperá ${seconds} segundos`);
    },
  );

  it.each([undefined, -5, 7.5])(
    "uses the fallback for Retry-After %s",
    (seconds) => {
      const result = failure(
        new ApiError("http", "Demasiadas solicitudes.", {
          status: 429,
          retryAfterSeconds: seconds,
        }),
      );

      expect(result).toEqual({
        ok: false,
        message: "Demasiados reportes. Esperá un momento y volvé a intentar.",
        retryable: true,
        unavailable: false,
      });
    },
  );

  it("maps a 5xx to a retryable message and never echoes its detail", () => {
    const result = failure(
      new ApiError("http", "Error del servidor.", {
        status: 500,
        detail: "boom",
      }),
    );

    expect(result).toEqual({
      ok: false,
      message: "Error del servidor.",
      retryable: true,
      unavailable: false,
    });
    expect(result).not.toHaveProperty("detail");
  });

  it("maps any other HTTP status to a non-retryable message without detail", () => {
    const result = failure(
      new ApiError("http", "Error en la solicitud.", {
        status: 403,
        detail: "forbidden",
      }),
    );

    expect(result).toEqual({
      ok: false,
      message: "Error en la solicitud.",
      retryable: false,
      unavailable: false,
    });
    expect(result).not.toHaveProperty("detail");
  });

  it("treats an HTTP error without a status as non-retryable", () => {
    expect(failure(new ApiError("http", "Error en la solicitud."))).toEqual({
      ok: false,
      message: "Error en la solicitud.",
      retryable: false,
      unavailable: false,
    });
  });

  it("passes a validation input message and its detail through", () => {
    const result = failure(
      new ApiError("validation", "Escribí un comentario para el motivo Otro.", {
        detail: "detalle",
      }),
    );

    expect(result).toEqual({
      ok: false,
      message: "Escribí un comentario para el motivo Otro.",
      detail: "detalle",
      retryable: false,
      unavailable: false,
    });
  });

  it("keeps the response-shape message and its field detail", () => {
    const result = failure(
      new ApiError("validation", "Respuesta inválida del servidor.", {
        detail: "estado de reporte inválido",
      }),
    );

    expect(result).toEqual({
      ok: false,
      message: "Respuesta inválida del servidor.",
      detail: "estado de reporte inválido",
      retryable: false,
      unavailable: false,
    });
  });

  it("omits a missing validation detail", () => {
    const result = failure(new ApiError("validation", "Mensaje."));

    expect(result).toEqual({
      ok: false,
      message: "Mensaje.",
      retryable: false,
      unavailable: false,
    });
  });
});

describe("getReportCommentError", () => {
  it("accepts an empty comment for the three optional reasons", () => {
    expect(getReportCommentError("traduccion", "")).toBeNull();
    expect(getReportCommentError("respuesta_incorrecta", "")).toBeNull();
    expect(getReportCommentError("error_texto", "")).toBeNull();
  });

  it("accepts a whitespace-only comment for the optional reasons", () => {
    expect(getReportCommentError("traduccion", "   ")).toBeNull();
  });

  it("requires a non-empty comment for otro", () => {
    expect(getReportCommentError("otro", "")).toBe(
      "Escribí un comentario para el motivo Otro.",
    );
    expect(getReportCommentError("otro", "   ")).toBe(
      "Escribí un comentario para el motivo Otro.",
    );
    expect(getReportCommentError("otro", "  Falta la tilde  ")).toBeNull();
  });

  it("rejects a raw comment over 500 characters before the otro rule", () => {
    expect(getReportCommentError("traduccion", "a".repeat(501))).toBe(
      "El comentario no puede superar los 500 caracteres.",
    );
    expect(getReportCommentError("otro", "a".repeat(501))).toBe(
      "El comentario no puede superar los 500 caracteres.",
    );
  });

  it("accepts exactly 500 characters", () => {
    expect(getReportCommentError("traduccion", "a".repeat(500))).toBeNull();
  });

  it("returns no error for a null reason", () => {
    expect(getReportCommentError(null, "")).toBeNull();
    expect(getReportCommentError(null, "   ")).toBeNull();
  });
});
