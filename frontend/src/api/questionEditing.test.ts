import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getQuestion,
  getQuestionEdits,
  hideQuestion,
  updateQuestion,
} from "./questionEditing";
import type {
  AdminQuestion,
  AdminQuestionPatch,
  AdminQuestionUpdateResult,
} from "./types";

const F_Q42: AdminQuestion = {
  id: 42,
  question: "Capital of Peru?",
  answer: "Lima",
  wrong_1: "Quito",
  wrong_2: "Bogotá",
  wrong_3: "Santiago",
  category: "geografia",
  source: "ia",
  question_es: "¿Capital del Perú?",
  answer_es: "Lima",
  wrong_1_es: "Quito",
  wrong_2_es: "Bogotá",
  wrong_3_es: "Santiago",
  is_translated: true,
  translation_model: "gpt-4.1-mini",
  is_active: true,
};

const F_Q43: AdminQuestion = {
  ...F_Q42,
  id: 43,
  question: "Capital of Ecuador?",
  answer: "Quito",
  wrong_1: "Guayaquil",
  wrong_2: "Cuenca",
  wrong_3: "Loja",
  question_es: null,
  answer_es: null,
  wrong_1_es: null,
  wrong_2_es: null,
  wrong_3_es: null,
  is_translated: false,
  translation_model: null,
  is_active: false,
};

const F_Q44: AdminQuestion = {
  ...F_Q42,
  id: 44,
  question_es: "",
  answer_es: "",
  wrong_1_es: "",
  wrong_2_es: "",
  wrong_3_es: "",
  is_translated: false,
  translation_model: null,
};

const PR_OK: AdminQuestionUpdateResult = {
  changed_fields: ["question", "wrong_2"],
  question: {
    ...F_Q42,
    question: "Capital of Peru (country)?",
    wrong_2: "Arequipa",
  },
};

const H_ORDER = [
  {
    id: 9,
    field: "question",
    old_value: "Capital of Peru?",
    new_value: "Capital of Peru (country)?",
    edited_at: "2026-10-26T12:00:00Z",
  },
  {
    id: 4,
    field: "is_active",
    old_value: "false",
    new_value: "true",
    edited_at: "2026-10-26T13:00:00Z",
  },
  {
    id: 7,
    field: "foo",
    old_value: "x",
    new_value: "y",
    edited_at: "2026-10-26T14:00:00Z",
  },
];

const SERVER_ERROR = {
  kind: "validation",
  message: "Respuesta inválida del servidor.",
} as const;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function fetchMock(): ReturnType<typeof vi.fn> {
  return globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
}

function call(index = 0): [string, RequestInit] {
  const [url, init] = fetchMock().mock.calls[index] as [string, RequestInit];
  return [String(url), init ?? {}];
}

function parsedBody(index = 0): unknown {
  return JSON.parse(String(call(index)[1].body));
}

async function questionRejection(body: unknown, detail: string) {
  fetchMock().mockReset().mockResolvedValueOnce(jsonResponse(body));
  await expect(getQuestion("clave", 42)).rejects.toMatchObject({
    ...SERVER_ERROR,
    detail,
  });
  expect(fetchMock()).toHaveBeenCalledTimes(1);
}

describe("question editing API client", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("VITE_API_URL", "http://localhost:8000");
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it("QAPI-01 getQuestion sends exactly GET /questions/42 with only X-API-Key", async () => {
    fetchMock().mockResolvedValueOnce(jsonResponse(F_Q42));

    const question = await getQuestion("clave", 42);

    expect(question).toEqual(F_Q42);
    expect(fetchMock()).toHaveBeenCalledTimes(1);
    const [url, init] = call();
    expect(url).toBe("http://localhost:8000/questions/42");
    expect(init.method).toBe("GET");
    expect(init.headers).toEqual({ "X-API-Key": "clave" });
    expect(init.body).toBeUndefined();
    expect(url).not.toContain("clave");
  });

  it("QAPI-02 getQuestion accepts null and empty strings for every nullable field", async () => {
    fetchMock()
      .mockResolvedValueOnce(jsonResponse(F_Q43))
      .mockResolvedValueOnce(jsonResponse(F_Q44));

    await expect(getQuestion("clave", 43)).resolves.toEqual(F_Q43);
    await expect(getQuestion("clave", 44)).resolves.toEqual(F_Q44);
    expect(fetchMock()).toHaveBeenCalledTimes(2);
  });

  it("QAPI-03 getQuestion ignores an extra field in the body", async () => {
    const body = { ...F_Q42, created_at: "2026-10-26T12:00:00Z" };
    fetchMock().mockResolvedValueOnce(jsonResponse(body));

    await expect(getQuestion("clave", 42)).resolves.toEqual(body);
    expect(fetchMock()).toHaveBeenCalledTimes(1);
  });

  it("QAPI-04 getQuestion propagates the body, id and text details", async () => {
    await questionRejection(null, "pregunta inválida");
    await questionRejection([], "pregunta inválida");
    await questionRejection("x", "pregunta inválida");
    await questionRejection({ ...F_Q42, id: 0 }, "id de pregunta inválido");
    await questionRejection({ ...F_Q42, id: 1.5 }, "id de pregunta inválido");
    await questionRejection({ ...F_Q42, id: "42" }, "id de pregunta inválido");
    await questionRejection(
      { ...F_Q42, question: "" },
      "texto de pregunta inválido",
    );
    await questionRejection(
      { ...F_Q42, answer: null },
      "respuesta de la pregunta inválida",
    );
    await questionRejection(
      { ...F_Q42, wrong_1: "" },
      "primera opción incorrecta inválida",
    );
    await questionRejection(
      { ...F_Q42, wrong_2: "" },
      "segunda opción incorrecta inválida",
    );
    await questionRejection(
      { ...F_Q42, wrong_3: "" },
      "tercera opción incorrecta inválida",
    );
  });

  it("QAPI-05 getQuestion propagates the nullable and boolean details", async () => {
    for (const [field, detail] of [
      ["category", "categoría de la pregunta inválida"],
      ["source", "origen de la pregunta inválido"],
      ["translation_model", "modelo de traducción inválido"],
      ["question_es", "texto de pregunta en español inválido"],
      ["answer_es", "respuesta en español inválida"],
      ["wrong_1_es", "primera opción incorrecta en español inválida"],
      ["wrong_2_es", "segunda opción incorrecta en español inválida"],
      ["wrong_3_es", "tercera opción incorrecta en español inválida"],
    ] as const) {
      await questionRejection({ ...F_Q42, [field]: 7 }, detail);
    }
    await questionRejection(
      { ...F_Q42, is_translated: "true" },
      "indicador de traducción inválido",
    );
    await questionRejection(
      { ...F_Q42, is_active: "true" },
      "indicador de publicación inválido",
    );
  });

  it("QAPI-06 updateQuestion sends exactly PATCH /questions/42 with the trimmed body", async () => {
    fetchMock().mockResolvedValueOnce(jsonResponse(PR_OK));

    const result = await updateQuestion("clave", 42, {
      question: "  Capital of Peru (country)?  ",
      wrong_2: "  Arequipa  ",
    });

    expect(result).toEqual(PR_OK);
    expect(fetchMock()).toHaveBeenCalledTimes(1);
    const [url, init] = call();
    expect(url).toBe("http://localhost:8000/questions/42");
    expect(init.method).toBe("PATCH");
    expect(init.headers).toEqual({
      "X-API-Key": "clave",
      "Content-Type": "application/json",
    });
    expect(String(init.body)).toBe(
      '{"question":"Capital of Peru (country)?","wrong_2":"Arequipa"}',
    );
    expect(Object.keys(parsedBody() as Record<string, unknown>)).toEqual([
      "question",
      "wrong_2",
    ]);
  });

  it("QAPI-07 updateQuestion preserves the frozen key order for a four-key and an eleven-key patch", async () => {
    fetchMock()
      .mockResolvedValueOnce(jsonResponse(PR_OK))
      .mockResolvedValueOnce(jsonResponse(PR_OK));

    await updateQuestion("clave", 42, {
      question: "Capital of Peru (country)?",
      answer: "Lima",
      wrong_1: "Quito",
      wrong_2: "Arequipa",
    });
    expect(Object.keys(parsedBody(0) as Record<string, unknown>)).toEqual([
      "question",
      "answer",
      "wrong_1",
      "wrong_2",
    ]);

    await updateQuestion("clave", 42, {
      question: "q",
      answer: "a",
      wrong_1: "w1",
      wrong_2: "w2",
      wrong_3: "w3",
      question_es: "qe",
      answer_es: "ae",
      wrong_1_es: "w1e",
      wrong_2_es: "w2e",
      wrong_3_es: "w3e",
      is_active: true,
    });
    expect(Object.keys(parsedBody(1) as Record<string, unknown>)).toEqual([
      "question",
      "answer",
      "wrong_1",
      "wrong_2",
      "wrong_3",
      "question_es",
      "answer_es",
      "wrong_1_es",
      "wrong_2_es",
      "wrong_3_es",
      "is_active",
    ]);
  });

  it("QAPI-08 updateQuestion trims every text field once and never adds an untouched key", async () => {
    fetchMock().mockResolvedValueOnce(jsonResponse(PR_OK));

    await updateQuestion("clave", 42, {
      question: "  q  ",
      answer: "  a  ",
      wrong_1: "  w1  ",
      wrong_2: "  w2  ",
      wrong_3: "  w3  ",
      question_es: "  qe  ",
      answer_es: "  ae  ",
      wrong_1_es: "  w1e  ",
      wrong_2_es: "  w2e  ",
      wrong_3_es: "  w3e  ",
    });

    expect(parsedBody()).toEqual({
      question: "q",
      answer: "a",
      wrong_1: "w1",
      wrong_2: "w2",
      wrong_3: "w3",
      question_es: "qe",
      answer_es: "ae",
      wrong_1_es: "w1e",
      wrong_2_es: "w2e",
      wrong_3_es: "w3e",
    });
    expect(Object.keys(parsedBody() as Record<string, unknown>)).toHaveLength(
      10,
    );
  });

  it('QAPI-09 updateQuestion accepts is_active true alone as {"is_active":true}', async () => {
    const result: AdminQuestionUpdateResult = {
      changed_fields: ["is_active"],
      question: { ...F_Q43, is_active: true },
    };
    fetchMock().mockResolvedValueOnce(jsonResponse(result));

    await updateQuestion("clave", 43, { is_active: true });

    expect(String(call()[1].body)).toBe('{"is_active":true}');
    expect(Object.keys(parsedBody() as Record<string, unknown>)).toEqual([
      "is_active",
    ]);
  });

  it('QAPI-10 updateQuestion rejects is_active false, "true" and a non-object patch without fetch', async () => {
    for (const patch of [
      { is_active: false },
      { is_active: "true" },
      { is_active: 1 },
      null,
      [],
      "x",
    ]) {
      await expect(
        updateQuestion("clave", 42, patch as unknown as AdminQuestionPatch),
      ).rejects.toMatchObject({
        kind: "validation",
        message: "El cambio de la pregunta no es válido.",
      });
    }
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("QAPI-11 updateQuestion rejects an empty patch and an unknown key without fetch", async () => {
    for (const patch of [{}, { id: 42 }, { foo: "x" }]) {
      await expect(
        updateQuestion("clave", 42, patch as unknown as AdminQuestionPatch),
      ).rejects.toMatchObject({
        kind: "validation",
        message: "El cambio de la pregunta no es válido.",
      });
    }
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("QAPI-12 updateQuestion rejects a non-string and a whitespace-only text value without fetch", async () => {
    for (const patch of [
      { question: 42 },
      { question: null },
      { question: "   " },
      { wrong_1: "\n\t " },
    ]) {
      await expect(
        updateQuestion("clave", 42, patch as unknown as AdminQuestionPatch),
      ).rejects.toMatchObject({
        kind: "validation",
        message: "El cambio de la pregunta no es válido.",
      });
    }
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("QAPI-13 updateQuestion accepts 1000 and 300 and rejects 1001 and 301 without fetch", async () => {
    const longQuestion = "a".repeat(1000);
    const longOption = "b".repeat(300);
    fetchMock()
      .mockResolvedValueOnce(
        jsonResponse({
          changed_fields: ["question"],
          question: { ...F_Q42, question: longQuestion },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          changed_fields: ["wrong_1"],
          question: { ...F_Q42, wrong_1: longOption },
        }),
      );

    await expect(
      updateQuestion("clave", 42, { question: longQuestion }),
    ).resolves.toMatchObject({ changed_fields: ["question"] });
    await expect(
      updateQuestion("clave", 42, { wrong_1: longOption }),
    ).resolves.toMatchObject({ changed_fields: ["wrong_1"] });
    expect(fetchMock()).toHaveBeenCalledTimes(2);

    fetchMock().mockClear();
    for (const patch of [
      { question: "a".repeat(1001) },
      { wrong_1: "b".repeat(301) },
    ]) {
      await expect(
        updateQuestion("clave", 42, patch as AdminQuestionPatch),
      ).rejects.toMatchObject({
        kind: "validation",
        message: "El cambio de la pregunta no es válido.",
      });
    }
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("QAPI-14 hideQuestion sends exactly DELETE /questions/42 with no body", async () => {
    fetchMock().mockResolvedValueOnce(
      jsonResponse({ id: 42, is_active: false }),
    );

    const result = await hideQuestion("clave", 42);

    expect(result).toEqual({ id: 42, is_active: false });
    expect(fetchMock()).toHaveBeenCalledTimes(1);
    const [url, init] = call();
    expect(url).toBe("http://localhost:8000/questions/42");
    expect(init.method).toBe("DELETE");
    expect(init.headers).toEqual({ "X-API-Key": "clave" });
    expect(init.body).toBeUndefined();
  });

  it("QAPI-15 hideQuestion rejects a hidden response whose is_active is true", async () => {
    fetchMock()
      .mockResolvedValueOnce(jsonResponse({ id: 42, is_active: true }))
      .mockResolvedValueOnce(jsonResponse("x"))
      .mockResolvedValueOnce(jsonResponse({ id: 0, is_active: false }));

    await expect(hideQuestion("clave", 42)).rejects.toMatchObject({
      ...SERVER_ERROR,
      detail: "indicador de publicación inválido",
    });
    await expect(hideQuestion("clave", 42)).rejects.toMatchObject({
      ...SERVER_ERROR,
      detail: "respuesta de ocultamiento inválida",
    });
    await expect(hideQuestion("clave", 42)).rejects.toMatchObject({
      ...SERVER_ERROR,
      detail: "id de pregunta inválido",
    });
    expect(fetchMock()).toHaveBeenCalledTimes(3);
  });

  it("QAPI-16 getQuestionEdits sends exactly GET /questions/42/edits with only X-API-Key", async () => {
    fetchMock().mockResolvedValueOnce(jsonResponse(H_ORDER));

    const edits = await getQuestionEdits("clave", 42);

    expect(edits).toEqual(H_ORDER);
    expect(fetchMock()).toHaveBeenCalledTimes(1);
    const [url, init] = call();
    expect(url).toBe("http://localhost:8000/questions/42/edits");
    expect(init.method).toBe("GET");
    expect(init.headers).toEqual({ "X-API-Key": "clave" });
    expect(init.body).toBeUndefined();
    expect(url).not.toContain("clave");
  });

  it("QAPI-17 getQuestionEdits returns the received order with edited_at and is_active values as strings", async () => {
    fetchMock().mockResolvedValueOnce(jsonResponse(H_ORDER));

    const edits = await getQuestionEdits("clave", 42);

    expect(edits).not.toBe(H_ORDER);
    expect(edits.map((edit) => edit.id)).toEqual([9, 4, 7]);
    expect(edits[0].edited_at).toBe("2026-10-26T12:00:00Z");
    expect(edits[1].old_value).toBe("false");
    expect(edits[1].new_value).toBe("true");
    expect(typeof edits[1].old_value).toBe("string");
    expect(typeof edits[1].new_value).toBe("string");
  });

  it("QAPI-18 getQuestionEdits propagates the edits details", async () => {
    const edit = {
      id: 9,
      field: "question",
      old_value: "A",
      new_value: "B",
      edited_at: "2026-10-26T12:00:00Z",
    };
    const cases: [unknown, string][] = [
      [{ not: "an array" }, "lista de ediciones inválida"],
      [[null], "edición inválida"],
      [[{ ...edit, id: 0 }], "id de edición inválido"],
      [[{ ...edit, field: "" }], "campo de edición inválido"],
      [[{ ...edit, old_value: 0 }], "valor anterior inválido"],
      [[{ ...edit, new_value: {} }], "valor nuevo inválido"],
      [[{ ...edit, edited_at: "" }], "fecha de edición inválida"],
    ];

    for (const [body, detail] of cases) {
      fetchMock().mockReset().mockResolvedValueOnce(jsonResponse(body));
      await expect(getQuestionEdits("clave", 42)).rejects.toMatchObject({
        ...SERVER_ERROR,
        detail,
      });
      expect(fetchMock()).toHaveBeenCalledTimes(1);
    }
  });

  it("QAPI-19 the four functions reject a missing, empty or non-string key without fetch", async () => {
    for (const key of ["", 42, null, undefined]) {
      const badKey = key as unknown as string;
      await expect(getQuestion(badKey, 42)).rejects.toMatchObject({
        kind: "validation",
        message: "La clave de administración es obligatoria.",
      });
      await expect(
        updateQuestion(badKey, 42, { question: "q" }),
      ).rejects.toMatchObject({
        kind: "validation",
        message: "La clave de administración es obligatoria.",
      });
      await expect(hideQuestion(badKey, 42)).rejects.toMatchObject({
        kind: "validation",
        message: "La clave de administración es obligatoria.",
      });
      await expect(getQuestionEdits(badKey, 42)).rejects.toMatchObject({
        kind: "validation",
        message: "La clave de administración es obligatoria.",
      });
    }
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("QAPI-20 the four functions reject an invalid question id without fetch", async () => {
    for (const questionId of [0, -1, 1.5, "42"]) {
      const badId = questionId as unknown as number;
      await expect(getQuestion("clave", badId)).rejects.toMatchObject({
        kind: "validation",
        message: "La pregunta no es válida.",
      });
      await expect(
        updateQuestion("clave", badId, { question: "q" }),
      ).rejects.toMatchObject({
        kind: "validation",
        message: "La pregunta no es válida.",
      });
      await expect(hideQuestion("clave", badId)).rejects.toMatchObject({
        kind: "validation",
        message: "La pregunta no es válida.",
      });
      await expect(getQuestionEdits("clave", badId)).rejects.toMatchObject({
        kind: "validation",
        message: "La pregunta no es válida.",
      });
    }
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("QAPI-21 a 404, a 422 and a 500 propagate through updateQuestion", async () => {
    fetchMock()
      .mockResolvedValueOnce(
        jsonResponse({ detail: "Question not found" }, 404),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            detail: [
              {
                loc: ["body", "wrong_2"],
                msg: "las opciones deben ser distintas",
              },
            ],
          },
          422,
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ detail: "boom" }, 500));

    await expect(
      updateQuestion("clave", 42, { wrong_2: "Arequipa" }),
    ).rejects.toMatchObject({
      kind: "http",
      status: 404,
      detail: "Question not found",
    });
    await expect(
      updateQuestion("clave", 42, { wrong_2: "Arequipa" }),
    ).rejects.toMatchObject({
      kind: "http",
      status: 422,
      detail: "las opciones deben ser distintas",
    });
    await expect(
      updateQuestion("clave", 42, { wrong_2: "Arequipa" }),
    ).rejects.toMatchObject({
      kind: "http",
      status: 500,
      message: "Error del servidor.",
    });
  });

  it("QAPI-22 updateQuestion accepts changed_fields [] and an unknown name unchanged", async () => {
    const empty: AdminQuestionUpdateResult = {
      changed_fields: [],
      question: F_Q42,
    };
    const unknown: AdminQuestionUpdateResult = {
      changed_fields: ["foo", "wrong_2"],
      question: { ...F_Q42, wrong_2: "Arequipa" },
    };
    fetchMock()
      .mockResolvedValueOnce(jsonResponse(empty))
      .mockResolvedValueOnce(jsonResponse(unknown));

    await expect(
      updateQuestion("clave", 42, { wrong_2: "Arequipa" }),
    ).resolves.toMatchObject({ changed_fields: [] });
    await expect(
      updateQuestion("clave", 42, { wrong_2: "Arequipa" }),
    ).resolves.toMatchObject({ changed_fields: ["foo", "wrong_2"] });
  });

  it("QAPI-23 the key never leaves the X-API-Key header", async () => {
    fetchMock()
      .mockResolvedValueOnce(jsonResponse(F_Q42))
      .mockResolvedValueOnce(jsonResponse(PR_OK))
      .mockResolvedValueOnce(jsonResponse({ id: 42, is_active: false }))
      .mockResolvedValueOnce(jsonResponse(H_ORDER));

    await getQuestion("clave", 42);
    await updateQuestion("clave", 42, { wrong_2: "Arequipa" });
    await hideQuestion("clave", 42);
    await getQuestionEdits("clave", 42);

    for (const index of [0, 1, 2, 3]) {
      const [url, init] = call(index);
      expect(url).not.toContain("clave");
      expect(String(init.body)).not.toContain("clave");
      expect(JSON.stringify({ ...init, headers: undefined })).not.toContain(
        "clave",
      );
      const headers = init.headers as Record<string, string>;
      expect(headers["X-API-Key"]).toBe("clave");
      expect(
        Object.keys(headers).filter((name) => headers[name] === "clave"),
      ).toEqual(["X-API-Key"]);
    }
  });

  it("QAPI-24 the input checks run in the frozen order", async () => {
    await expect(
      updateQuestion("", 0, {} as AdminQuestionPatch),
    ).rejects.toMatchObject({
      kind: "validation",
      message: "La clave de administración es obligatoria.",
    });
    await expect(
      updateQuestion("clave", 0, {} as AdminQuestionPatch),
    ).rejects.toMatchObject({
      kind: "validation",
      message: "La pregunta no es válida.",
    });
    await expect(
      updateQuestion("clave", 42, { question: "   " }),
    ).rejects.toMatchObject({
      kind: "validation",
      message: "El cambio de la pregunta no es válido.",
    });
    expect(fetchMock()).not.toHaveBeenCalled();
  });
});
