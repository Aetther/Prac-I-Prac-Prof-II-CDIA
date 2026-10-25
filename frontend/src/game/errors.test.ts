// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ApiError } from "../api/errors";
import { getApiErrorMessage } from "./errors";

describe("API error message mapping", () => {
  it("maps network to the exact API message", () => {
    const error = new ApiError(
      "network",
      "Error de conexión. Verificá que la API esté corriendo.",
      {},
    );
    expect(getApiErrorMessage(error)).toBe("¿Está corriendo la API?");
  });

  it("maps timeout to the exact API message", () => {
    const error = new ApiError(
      "timeout",
      "La solicitud tardó demasiado tiempo.",
      {},
    );
    expect(getApiErrorMessage(error)).toBe("¿Está corriendo la API?");
  });

  it("returns the server message for an HTTP 500 verbatim", () => {
    const error = new ApiError("http", "Error del servidor.", {
      status: 500,
    });
    expect(getApiErrorMessage(error)).toBe("Error del servidor.");
  });

  it("returns the validation message verbatim", () => {
    const httpValidation = new ApiError(
      "http",
      "Los datos enviados no son válidos.",
      { status: 422 },
    );
    const validation = new ApiError(
      "validation",
      "Respuesta inválida del servidor.",
      { detail: "opciones inválidas" },
    );
    expect(getApiErrorMessage(httpValidation)).toBe(
      "Los datos enviados no son válidos.",
    );
    expect(getApiErrorMessage(validation)).toBe(
      "Respuesta inválida del servidor.",
    );
  });

  it("returns the 422 message verbatim", () => {
    const error = new ApiError("http", "Los datos enviados no son válidos.", {
      status: 422,
    });
    expect(getApiErrorMessage(error)).toBe(
      "Los datos enviados no son válidos.",
    );
  });

  it("returns the 404 message for a submit error", () => {
    const error = new ApiError("http", "Recurso no encontrado.", {
      status: 404,
    });
    expect(getApiErrorMessage(error)).toBe("Recurso no encontrado.");
    expect(getApiErrorMessage(error)).not.toBe("¿Está corriendo la API?");
  });
});
