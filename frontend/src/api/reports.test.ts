import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReportReason } from "./types";
import { reportQuestion } from "./reports";

const validResult = {
  id: 7,
  question_id: 42,
  reason: "traduccion",
  status: "pendiente",
  created_at: "2026-10-26T12:00:00Z",
};

function jsonResponse(body: unknown, status = 201): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function fetchMock(): ReturnType<typeof vi.fn> {
  return globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
}

function parsedBody(index = 0): unknown {
  return JSON.parse(String(fetchMock().mock.calls[index][1].body));
}

describe("reportQuestion", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("VITE_API_URL", "http://localhost:8000");
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(validResult));
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  const rows: readonly [ReportReason, string | null, unknown][] = [
    ["traduccion", null, { question_id: 42, reason: "traduccion", lang: "es" }],
    [
      "traduccion",
      "  texto  ",
      { question_id: 42, reason: "traduccion", comment: "texto", lang: "es" },
    ],
    [
      "respuesta_incorrecta",
      null,
      { question_id: 42, reason: "respuesta_incorrecta", lang: "es" },
    ],
    [
      "respuesta_incorrecta",
      "  texto  ",
      {
        question_id: 42,
        reason: "respuesta_incorrecta",
        comment: "texto",
        lang: "es",
      },
    ],
    [
      "error_texto",
      null,
      { question_id: 42, reason: "error_texto", lang: "es" },
    ],
    [
      "error_texto",
      "  texto  ",
      { question_id: 42, reason: "error_texto", comment: "texto", lang: "es" },
    ],
    [
      "otro",
      "  Falta la tilde  ",
      {
        question_id: 42,
        reason: "otro",
        comment: "Falta la tilde",
        lang: "es",
      },
    ],
  ];

  it.each(rows)(
    "sends the exact POST body for %s with comment %j",
    async (reason, comment, expected) => {
      const result = await reportQuestion(42, reason, comment, "es");

      expect(result).toEqual(validResult);
      expect(fetchMock()).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock().mock.calls[0];
      expect(String(url)).toBe("http://localhost:8000/reports");
      expect(init.method).toBe("POST");
      expect(init.headers).toEqual({ "Content-Type": "application/json" });
      expect(parsedBody()).toStrictEqual(expected);
    },
  );

  it("omits the comment key when the trimmed value is empty", async () => {
    await reportQuestion(42, "error_texto", "   ", "es");

    expect(parsedBody()).toStrictEqual({
      question_id: 42,
      reason: "error_texto",
      lang: "es",
    });
    expect(Object.keys(parsedBody() as object)).toEqual([
      "question_id",
      "reason",
      "lang",
    ]);
  });

  it("accepts each documented status unchanged", async () => {
    for (const status of ["pendiente", "resuelto", "descartado"]) {
      fetchMock().mockResolvedValueOnce(
        jsonResponse({ ...validResult, status }),
      );
      const result = await reportQuestion(42, "traduccion", null, "es");
      expect(result.status).toBe(status);
    }
  });

  it("sends the match language it receives", async () => {
    await reportQuestion(42, "traduccion", null, "en");

    expect(parsedBody()).toStrictEqual({
      question_id: 42,
      reason: "traduccion",
      lang: "en",
    });
  });

  it("rejects an invalid question id without calling fetch", async () => {
    await expect(
      reportQuestion(0, "traduccion", null, "es"),
    ).rejects.toMatchObject({
      kind: "validation",
      message: "La pregunta del reporte no es válida.",
    });
    expect(fetchMock()).not.toHaveBeenCalled();

    await expect(
      reportQuestion(1.5, "traduccion", null, "es"),
    ).rejects.toMatchObject({
      kind: "validation",
      message: "La pregunta del reporte no es válida.",
    });
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("rejects an unknown reason without calling fetch", async () => {
    await expect(
      reportQuestion(42, "foo" as ReportReason, null, "es"),
    ).rejects.toMatchObject({
      kind: "validation",
      message: "El motivo del reporte no es válido.",
    });
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("rejects an invalid language without calling fetch", async () => {
    await expect(
      reportQuestion(42, "traduccion", null, "fr" as "es"),
    ).rejects.toMatchObject({
      kind: "validation",
      message: "El idioma del reporte no es válido.",
    });
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("rejects a non-string comment without calling fetch", async () => {
    await expect(
      reportQuestion(42, "traduccion", 7 as unknown as string, "es"),
    ).rejects.toMatchObject({
      kind: "validation",
      message: "El comentario del reporte no es válido.",
    });
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("rejects a raw comment over 500 characters without calling fetch", async () => {
    await expect(
      reportQuestion(42, "traduccion", "a".repeat(501), "es"),
    ).rejects.toMatchObject({
      kind: "validation",
      message: "El comentario no puede superar los 500 caracteres.",
    });
    expect(fetchMock()).not.toHaveBeenCalled();

    await reportQuestion(42, "traduccion", "a".repeat(500), "es");
    expect(fetchMock()).toHaveBeenCalledTimes(1);
    const body = parsedBody() as { comment?: string };
    expect(body.comment).toHaveLength(500);
    expect(body.comment).toBe("a".repeat(500));
  });

  it("rejects otro with a null, empty or whitespace-only comment without fetch", async () => {
    for (const comment of [null, "", "   "]) {
      await expect(
        reportQuestion(42, "otro", comment, "es"),
      ).rejects.toMatchObject({
        kind: "validation",
        message: "Escribí un comentario para el motivo Otro.",
      });
    }
    expect(fetchMock()).not.toHaveBeenCalled();

    await reportQuestion(42, "otro", "  Falta la tilde  ", "es");
    expect(fetchMock()).toHaveBeenCalledTimes(1);
  });

  it("returns a valid 201 exactly as received", async () => {
    const result = await reportQuestion(42, "traduccion", null, "es");

    expect(result).toStrictEqual(validResult);
  });

  it("rejects a non-object 201 body with the whole-body detail", async () => {
    fetchMock().mockResolvedValueOnce(jsonResponse(null));
    await expect(
      reportQuestion(42, "traduccion", null, "es"),
    ).rejects.toMatchObject({
      kind: "validation",
      message: "Respuesta inválida del servidor.",
      detail: "reporte inválido",
    });
  });

  it("rejects an array 201 body with the whole-body detail", async () => {
    fetchMock().mockResolvedValueOnce(jsonResponse([]));

    await expect(
      reportQuestion(42, "traduccion", null, "es"),
    ).rejects.toMatchObject({
      kind: "validation",
      message: "Respuesta inválida del servidor.",
      detail: "reporte inválido",
    });

    fetchMock().mockResolvedValueOnce(jsonResponse(validResult));
    await expect(
      reportQuestion(42, "traduccion", null, "es"),
    ).resolves.toStrictEqual(validResult);
  });

  it.each([
    [{ ...validResult, id: 0 }, "id de reporte inválido"],
    [{ ...validResult, id: 1.5 }, "id de reporte inválido"],
    [{ ...validResult, id: "7" }, "id de reporte inválido"],
    [{ ...validResult, question_id: 0 }, "question_id inválido"],
    [{ ...validResult, question_id: 1.5 }, "question_id inválido"],
    [{ ...validResult, question_id: "42" }, "question_id inválido"],
    [{ ...validResult, reason: "foo" }, "motivo de reporte inválido"],
    [{ ...validResult, reason: 7 }, "motivo de reporte inválido"],
    [{ ...validResult, status: "" }, "estado de reporte inválido"],
    [{ ...validResult, status: "pending" }, "estado de reporte inválido"],
    [{ ...validResult, status: 7 }, "estado de reporte inválido"],
    [{ ...validResult, created_at: "" }, "fecha de creación inválida"],
    [{ ...validResult, created_at: 7 }, "fecha de creación inválida"],
  ])("rejects an invalid 201 field %j", async (body, detail) => {
    fetchMock().mockResolvedValueOnce(jsonResponse(body));
    await expect(
      reportQuestion(42, "traduccion", null, "es"),
    ).rejects.toMatchObject({
      kind: "validation",
      message: "Respuesta inválida del servidor.",
      detail,
    });
  });

  it("rejects a missing status with the status detail", async () => {
    const { status: _status, ...withoutStatus } = validResult;
    void _status;
    fetchMock().mockResolvedValueOnce(jsonResponse(withoutStatus));

    await expect(
      reportQuestion(42, "traduccion", null, "es"),
    ).rejects.toMatchObject({
      kind: "validation",
      message: "Respuesta inválida del servidor.",
      detail: "estado de reporte inválido",
    });
  });

  it("rejects a missing created_at with the date detail", async () => {
    const { created_at: _createdAt, ...withoutDate } = validResult;
    void _createdAt;
    fetchMock().mockResolvedValueOnce(jsonResponse(withoutDate));

    await expect(
      reportQuestion(42, "traduccion", null, "es"),
    ).rejects.toMatchObject({
      kind: "validation",
      message: "Respuesta inválida del servidor.",
      detail: "fecha de creación inválida",
    });
  });

  it("keeps Retry-After seconds on a 429", async () => {
    fetchMock().mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "too many" }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "7",
        },
      }),
    );

    await expect(
      reportQuestion(42, "traduccion", null, "es"),
    ).rejects.toMatchObject({
      kind: "http",
      status: 429,
      retryAfterSeconds: 7,
    });
  });
});
