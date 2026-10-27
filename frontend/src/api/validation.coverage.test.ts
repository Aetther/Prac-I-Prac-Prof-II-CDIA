import { describe, expect, it } from "vitest";
import { ApiError } from "./errors";
import {
  isReportStatus,
  REPORT_STATUSES,
  validateAdminReport,
  validateAdminReportList,
  validateCategories,
  validateGameQuestion,
  validateReportQuestionResult,
  validateReportStats,
  validateSubmitAnswer,
} from "./validation";

describe("validation coverage", () => {
  it("validateCategories - not array", () => {
    expect(() => validateCategories({} as unknown)).toThrow(ApiError);
  });
  it("validateCategories - wrong length", () => {
    expect(() => validateCategories([] as unknown)).toThrow(ApiError);
  });
  it("validateCategories - item not object", () => {
    const arr = Array(6)
      .fill(null)
      .map((_, i) =>
        i === 0 ? null : { name: "n", label: "l", description: "d" },
      );
    expect(() => validateCategories(arr as unknown)).toThrow(ApiError);
  });
  it("validateCategories - name empty or not string", () => {
    const arr1 = Array(6).fill({ name: "", label: "l", description: "d" });
    expect(() => validateCategories(arr1 as unknown)).toThrow(ApiError);
    const arr2 = Array(6).fill({ name: 123, label: "l", description: "d" });
    expect(() => validateCategories(arr2 as unknown)).toThrow(ApiError);
  });
  it("validateCategories - label empty or not string", () => {
    const arr1 = Array(6).fill({ name: "n", label: "", description: "d" });
    expect(() => validateCategories(arr1 as unknown)).toThrow(ApiError);
    const arr2 = Array(6).fill({ name: "n", label: null, description: "d" });
    expect(() => validateCategories(arr2 as unknown)).toThrow(ApiError);
  });
  it("validateCategories - description empty or not string", () => {
    const arr1 = Array(6).fill({ name: "n", label: "l", description: "" });
    expect(() => validateCategories(arr1 as unknown)).toThrow(ApiError);
    const arr2 = Array(6).fill({
      name: "n",
      label: "l",
      description: undefined,
    });
    expect(() => validateCategories(arr2 as unknown)).toThrow(ApiError);
  });
  it("validateCategories - valid", () => {
    const arr = Array(6)
      .fill(0)
      .map((_, i) => ({ name: `n${i}`, label: `l${i}`, description: `d${i}` }));
    const res = validateCategories(arr);
    expect(res).toHaveLength(6);
  });

  it("validateGameQuestion - not object", () => {
    expect(() => validateGameQuestion(null)).toThrow(ApiError);
    expect(() => validateGameQuestion([])).toThrow(ApiError);
  });
  it("validateGameQuestion - id invalid", () => {
    const base = {
      id: 1,
      question: "q",
      category: "c",
      options: ["a", "b", "c", "d"],
      lang: "es",
    };
    expect(() => validateGameQuestion({ ...base, id: 0 })).toThrow(ApiError);
    expect(() => validateGameQuestion({ ...base, id: 1.5 })).toThrow(ApiError);
    expect(() => validateGameQuestion({ ...base, id: "1" })).toThrow(ApiError);
  });
  it("validateGameQuestion - question invalid", () => {
    const base = {
      id: 1,
      question: "q",
      category: "c",
      options: ["a", "b", "c", "d"],
      lang: "es",
    };
    expect(() => validateGameQuestion({ ...base, question: "" })).toThrow(
      ApiError,
    );
    expect(() => validateGameQuestion({ ...base, question: 123 })).toThrow(
      ApiError,
    );
  });
  it("validateGameQuestion - category invalid", () => {
    const base = {
      id: 1,
      question: "q",
      category: "c",
      options: ["a", "b", "c", "d"],
      lang: "es",
    };
    expect(() => validateGameQuestion({ ...base, category: "" })).toThrow(
      ApiError,
    );
    expect(() => validateGameQuestion({ ...base, category: null })).toThrow(
      ApiError,
    );
  });
  it("validateGameQuestion - options invalid", () => {
    const base = {
      id: 1,
      question: "q",
      category: "c",
      options: ["a", "b", "c", "d"],
      lang: "es",
    };
    expect(() => validateGameQuestion({ ...base, options: [] })).toThrow(
      ApiError,
    );
    expect(() =>
      validateGameQuestion({ ...base, options: ["a", "b", "c"] }),
    ).toThrow(ApiError);
    expect(() =>
      validateGameQuestion({ ...base, options: ["a", "b", "c", ""] }),
    ).toThrow(ApiError);
    expect(() =>
      validateGameQuestion({ ...base, options: ["a", "b", "c", 123] }),
    ).toThrow(ApiError);
  });
  it("validateGameQuestion - lang invalid", () => {
    const base = {
      id: 1,
      question: "q",
      category: "c",
      options: ["a", "b", "c", "d"],
      lang: "es",
    };
    expect(() => validateGameQuestion({ ...base, lang: "fr" })).toThrow(
      ApiError,
    );
  });
  it("validateGameQuestion - valid en", () => {
    const q = {
      id: 2,
      question: "q",
      category: "c",
      options: ["a", "b", "c", "d"],
      lang: "en",
    };
    const res = validateGameQuestion(q);
    expect(res.lang).toBe("en");
  });

  it("validateSubmitAnswer - not object", () => {
    expect(() => validateSubmitAnswer(null)).toThrow(ApiError);
    expect(() => validateSubmitAnswer("x")).toThrow(ApiError);
  });
  it("validateSubmitAnswer - correct invalid", () => {
    expect(() =>
      validateSubmitAnswer({ correct: "true", correct_answer: "A" }),
    ).toThrow(ApiError);
  });
  it("validateSubmitAnswer - correct_answer invalid", () => {
    expect(() =>
      validateSubmitAnswer({ correct: true, correct_answer: 123 }),
    ).toThrow(ApiError);
  });
  it("validateSubmitAnswer - valid", () => {
    const res = validateSubmitAnswer({ correct: false, correct_answer: "C" });
    expect(res.correct).toBe(false);
  });

  const report = {
    id: 7,
    question_id: 42,
    reason: "traduccion",
    status: "pendiente",
    created_at: "2026-10-26T12:00:00Z",
  };

  it("validateReportQuestionResult - not an object", () => {
    expect(() => validateReportQuestionResult(null)).toThrow(ApiError);
    expect(() => validateReportQuestionResult("x")).toThrow(ApiError);
  });

  it("validateReportQuestionResult - invalid id", () => {
    expect(() => validateReportQuestionResult({ ...report, id: 0 })).toThrow(
      ApiError,
    );
    expect(() => validateReportQuestionResult({ ...report, id: 1.5 })).toThrow(
      ApiError,
    );
    expect(() => validateReportQuestionResult({ ...report, id: "7" })).toThrow(
      ApiError,
    );
  });

  it("validateReportQuestionResult - invalid question_id", () => {
    expect(() =>
      validateReportQuestionResult({ ...report, question_id: 0 }),
    ).toThrow(ApiError);
    expect(() =>
      validateReportQuestionResult({ ...report, question_id: 1.5 }),
    ).toThrow(ApiError);
    expect(() =>
      validateReportQuestionResult({ ...report, question_id: null }),
    ).toThrow(ApiError);
  });

  it("validateReportQuestionResult - invalid reason", () => {
    expect(() =>
      validateReportQuestionResult({ ...report, reason: "foo" }),
    ).toThrow(ApiError);
    expect(() =>
      validateReportQuestionResult({ ...report, reason: 7 }),
    ).toThrow(ApiError);
  });

  it("validateReportQuestionResult - invalid status", () => {
    for (const status of ["", "pending", 7, undefined]) {
      expect(() => validateReportQuestionResult({ ...report, status })).toThrow(
        ApiError,
      );
    }
  });

  it("validateReportQuestionResult - invalid created_at", () => {
    expect(() =>
      validateReportQuestionResult({ ...report, created_at: "" }),
    ).toThrow(ApiError);
    expect(() =>
      validateReportQuestionResult({ ...report, created_at: 7 }),
    ).toThrow(ApiError);
  });

  it("validateReportQuestionResult - accepts each valid status", () => {
    for (const status of ["pendiente", "resuelto", "descartado"]) {
      expect(validateReportQuestionResult({ ...report, status }).status).toBe(
        status,
      );
    }
  });
});

const statsBase = {
  pendiente: 0,
  resuelto: 0,
  descartado: 0,
  pending_by_reason: {},
};

const adminQuestion = {
  question: "Capital of Peru?",
  answer: "Lima",
  question_es: "¿Capital del Perú?",
  answer_es: "Lima",
  is_translated: true,
  is_active: true,
};

const adminReport = {
  id: 7,
  question_id: 42,
  reason: "traduccion",
  comment: null,
  lang: "es",
  status: "pendiente",
  created_at: "2026-10-26T12:00:00Z",
  resolved_at: null,
  question: adminQuestion,
};

const serverError = {
  kind: "validation",
  message: "Respuesta inválida del servidor.",
} as const;

function statsRejection(input: unknown, detail: string): Promise<void> {
  return expect(
    Promise.resolve().then(() => validateReportStats(input)),
  ).rejects.toMatchObject({ ...serverError, detail });
}

function reportRejection(input: unknown, detail: string): Promise<void> {
  return expect(
    Promise.resolve().then(() => validateAdminReport(input)),
  ).rejects.toMatchObject({ ...serverError, detail });
}

function listRejection(input: unknown, detail: string): Promise<void> {
  return expect(
    Promise.resolve().then(() => validateAdminReportList(input)),
  ).rejects.toMatchObject({ ...serverError, detail });
}

describe("admin report validation", () => {
  it("VAL-01 validateReportStats rejects a non-object body", async () => {
    for (const input of [null, [], "x", 42]) {
      await statsRejection(input, "estadísticas inválidas");
    }
  });

  it("VAL-02 validateReportStats rejects each invalid counter", async () => {
    await statsRejection(
      { ...statsBase, pendiente: -1 },
      "contador de pendientes inválido",
    );
    await statsRejection(
      { ...statsBase, pendiente: 1.5 },
      "contador de pendientes inválido",
    );
    await statsRejection(
      { ...statsBase, pendiente: "3" },
      "contador de pendientes inválido",
    );
    await statsRejection(
      { ...statsBase, pendiente: undefined },
      "contador de pendientes inválido",
    );
    await statsRejection(
      { ...statsBase, resuelto: -1 },
      "contador de resueltos inválido",
    );
    await statsRejection(
      { ...statsBase, descartado: 1.5 },
      "contador de descartados inválido",
    );
  });

  it("VAL-03 validateReportStats rejects a null, array or scalar pending_by_reason", async () => {
    for (const reasons of [null, [], "x"]) {
      await statsRejection(
        { ...statsBase, pending_by_reason: reasons },
        "desglose por motivo inválido",
      );
    }
  });

  it("VAL-04 validateReportStats accepts unknown keys unchanged", async () => {
    for (const reasons of [
      { duplicada: 2 },
      { traduccion: 1, zombi: 3 },
      { "": 1 },
    ]) {
      const input = { ...statsBase, pending_by_reason: reasons };
      expect(validateReportStats(input)).toEqual(input);
    }
  });

  it("VAL-05 validateReportStats rejects a negative or non-integer reason count", async () => {
    for (const value of [-1, 1.5, "2", null]) {
      await statsRejection(
        { ...statsBase, pending_by_reason: { otro: value } },
        "contador por motivo inválido",
      );
    }
    await statsRejection(
      { ...statsBase, pending_by_reason: { duplicada: -1 } },
      "contador por motivo inválido",
    );
  });

  it("VAL-06 validateReportStats accepts missing keys, empty maps and zero and returns exactly", () => {
    const mixed = {
      pendiente: 3,
      resuelto: 1,
      descartado: 0,
      pending_by_reason: { otro: 1, traduccion: 2 },
    };
    const empty = {
      pendiente: 0,
      resuelto: 4,
      descartado: 2,
      pending_by_reason: {},
    };
    const unknown = {
      pendiente: 6,
      resuelto: 0,
      descartado: 0,
      pending_by_reason: { duplicada: 2, traduccion: 1, zombi: 3 },
    };
    const presentZero = {
      ...statsBase,
      pending_by_reason: { traduccion: 0 },
    };

    for (const input of [mixed, empty, unknown, presentZero]) {
      expect(validateReportStats(input)).toEqual(input);
    }
  });

  it("VAL-26 validateReportStats keeps a present zero for a known and an unknown key", () => {
    const known = { ...statsBase, pending_by_reason: { traduccion: 0 } };
    const unknown = { ...statsBase, pending_by_reason: { duplicada: 0 } };
    expect(validateReportStats(known)).toEqual(known);
    expect(validateReportStats(unknown)).toEqual(unknown);
  });

  it("VAL-07 validateAdminReport rejects a non-object or array body", async () => {
    for (const input of [null, [], "x", 42]) {
      await reportRejection(input, "reporte inválido");
    }
  });

  it("VAL-08 validateAdminReport rejects an invalid id", async () => {
    for (const id of [0, -1, 1.5, "7", undefined]) {
      await reportRejection({ ...adminReport, id }, "id de reporte inválido");
    }
  });

  it("VAL-09 validateAdminReport rejects an invalid question_id", async () => {
    for (const questionId of [0, 1.5, "42", undefined]) {
      await reportRejection(
        { ...adminReport, question_id: questionId },
        "question_id inválido",
      );
    }
  });

  it("VAL-10 validateAdminReport rejects an unknown reason", async () => {
    for (const reason of ["foo", "", "OTRO", undefined]) {
      await reportRejection(
        { ...adminReport, reason },
        "motivo de reporte inválido",
      );
    }
  });

  it("VAL-11 validateAdminReport accepts null, empty and non-empty comments and rejects other types", async () => {
    for (const comment of [null, "", "Falta la tilde"]) {
      expect(validateAdminReport({ ...adminReport, comment }).comment).toBe(
        comment,
      );
    }
    for (const comment of [0, {}, undefined]) {
      await reportRejection(
        { ...adminReport, comment },
        "comentario de reporte inválido",
      );
    }
  });

  it("VAL-12 validateAdminReport rejects an invalid lang", async () => {
    for (const lang of ["fr", "", 7, undefined]) {
      await reportRejection(
        { ...adminReport, lang },
        "idioma del reporte inválido",
      );
    }
  });

  it("VAL-13 validateAdminReport rejects an invalid status and accepts the three values", async () => {
    for (const status of ["", "pending", 7, undefined]) {
      await reportRejection(
        { ...adminReport, status },
        "estado de reporte inválido",
      );
    }
    for (const status of ["pendiente", "resuelto", "descartado"]) {
      expect(validateAdminReport({ ...adminReport, status }).status).toBe(
        status,
      );
    }
    expect(validateAdminReport({ ...adminReport, lang: "en" }).lang).toBe("en");
  });

  it("VAL-14 validateAdminReport rejects an empty or non-string created_at", async () => {
    for (const createdAt of ["", null, 7, undefined]) {
      await reportRejection(
        { ...adminReport, created_at: createdAt },
        "fecha de creación inválida",
      );
    }
    expect(
      validateAdminReport({
        ...adminReport,
        created_at: "2026-10-26T12:00:00Z",
      }).created_at,
    ).toBe("2026-10-26T12:00:00Z");
  });

  it("VAL-15 validateAdminReport accepts null resolved_at and rejects empty or non-string", async () => {
    expect(validateAdminReport(adminReport).resolved_at).toBeNull();
    for (const resolvedAt of ["", 7]) {
      await reportRejection(
        { ...adminReport, resolved_at: resolvedAt },
        "fecha de resolución inválida",
      );
    }
    expect(
      validateAdminReport({
        ...adminReport,
        resolved_at: "2026-10-27T09:30:00Z",
      }).resolved_at,
    ).toBe("2026-10-27T09:30:00Z");
  });

  it("VAL-16 validateAdminReport rejects a non-object question", async () => {
    for (const question of [null, [], "x", undefined]) {
      await reportRejection(
        { ...adminReport, question },
        "pregunta del reporte inválida",
      );
    }
  });

  it("VAL-17 validateAdminReport rejects an empty or non-string question.question", async () => {
    for (const question of ["", null, 7]) {
      await reportRejection(
        { ...adminReport, question: { ...adminQuestion, question } },
        "texto de pregunta inválido",
      );
    }
  });

  it("VAL-18 validateAdminReport rejects an empty or non-string question.answer", async () => {
    for (const answer of ["", null, 7]) {
      await reportRejection(
        { ...adminReport, question: { ...adminQuestion, answer } },
        "respuesta de la pregunta inválida",
      );
    }
  });

  it("VAL-19 validateAdminReport accepts null and empty question_es and rejects other values", async () => {
    expect(
      validateAdminReport({
        ...adminReport,
        question: { ...adminQuestion, question_es: null },
      }).question.question_es,
    ).toBeNull();
    expect(
      validateAdminReport({
        ...adminReport,
        question: { ...adminQuestion, question_es: "" },
      }).question.question_es,
    ).toBe("");
    for (const questionEs of [7, undefined]) {
      await reportRejection(
        {
          ...adminReport,
          question: { ...adminQuestion, question_es: questionEs },
        },
        "texto de pregunta en español inválido",
      );
    }
  });

  it("VAL-20 validateAdminReport accepts null and empty answer_es and rejects other non-strings", async () => {
    expect(
      validateAdminReport({
        ...adminReport,
        question: { ...adminQuestion, answer_es: null },
      }).question.answer_es,
    ).toBeNull();
    expect(
      validateAdminReport({
        ...adminReport,
        question: { ...adminQuestion, answer_es: "Lima" },
      }).question.answer_es,
    ).toBe("Lima");
    expect(
      validateAdminReport({
        ...adminReport,
        question: { ...adminQuestion, answer_es: "" },
      }).question.answer_es,
    ).toBe("");
    for (const answerEs of [7, undefined]) {
      await reportRejection(
        { ...adminReport, question: { ...adminQuestion, answer_es: answerEs } },
        "respuesta en español inválida",
      );
    }
  });

  it("VAL-21 validateAdminReport rejects a non-boolean is_translated", async () => {
    for (const isTranslated of ["true", 0, undefined]) {
      await reportRejection(
        {
          ...adminReport,
          question: { ...adminQuestion, is_translated: isTranslated },
        },
        "indicador de traducción inválido",
      );
    }
  });

  it("VAL-22 validateAdminReport rejects a non-boolean is_active", async () => {
    for (const isActive of ["false", 0, undefined]) {
      await reportRejection(
        { ...adminReport, question: { ...adminQuestion, is_active: isActive } },
        "indicador de publicación inválido",
      );
    }
  });

  it("VAL-23 validateAdminReportList rejects a non-array body", async () => {
    for (const input of [null, {}, "x"]) {
      await listRejection(input, "lista de reportes inválida");
    }
  });

  it("VAL-24 validateAdminReportList validates items in array order", async () => {
    const firstBad = {
      ...adminReport,
      question: { ...adminQuestion, answer: "" },
    };
    const secondBad = {
      ...adminReport,
      id: 8,
      question: { ...adminQuestion, question: "" },
    };
    await listRejection(
      [firstBad, secondBad],
      "respuesta de la pregunta inválida",
    );
    await listRejection([secondBad, firstBad], "texto de pregunta inválido");
  });

  it("VAL-25 validateAdminReportList returns a new array of the same values", () => {
    const second = { ...adminReport, id: 8, question_id: 43 };
    const input = [adminReport, second];
    const output = validateAdminReportList(input);
    expect(output).toEqual(input);
    expect(output).not.toBe(input);
  });

  it("exports REPORT_STATUSES and isReportStatus", () => {
    expect(REPORT_STATUSES).toEqual(["pendiente", "resuelto", "descartado"]);
    expect(isReportStatus("resuelto")).toBe(true);
    expect(isReportStatus("pending")).toBe(false);
  });
});
