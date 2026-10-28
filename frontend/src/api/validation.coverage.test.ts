import { describe, expect, it } from "vitest";
import { ApiError } from "./errors";
import {
  isReportStatus,
  REPORT_STATUSES,
  validateAdminQuestion,
  validateAdminQuestionEdits,
  validateAdminQuestionUpdate,
  validateAdminReport,
  validateAdminReportList,
  validateCategories,
  validateGameQuestion,
  validateHiddenQuestion,
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

const F_Q42 = {
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

const F_Q43 = {
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

const F_Q44 = {
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

function questionRejection(input: unknown, detail: string): Promise<void> {
  return expect(
    Promise.resolve().then(() => validateAdminQuestion(input)),
  ).rejects.toMatchObject({ ...serverError, detail });
}

function updateRejection(input: unknown, detail: string): Promise<void> {
  return expect(
    Promise.resolve().then(() => validateAdminQuestionUpdate(input)),
  ).rejects.toMatchObject({ ...serverError, detail });
}

function hiddenRejection(input: unknown, detail: string): Promise<void> {
  return expect(
    Promise.resolve().then(() => validateHiddenQuestion(input)),
  ).rejects.toMatchObject({ ...serverError, detail });
}

function editsRejection(input: unknown, detail: string): Promise<void> {
  return expect(
    Promise.resolve().then(() => validateAdminQuestionEdits(input)),
  ).rejects.toMatchObject({ ...serverError, detail });
}

describe("admin question validation", () => {
  it("QVAL-01 validateAdminQuestion rejects a non-object or array body", async () => {
    for (const input of [null, [], "x", 42, undefined]) {
      await questionRejection(input, "pregunta inválida");
    }
  });

  it("QVAL-02 validateAdminQuestion rejects an invalid id", async () => {
    for (const id of [0, -1, 1.5, "42", undefined]) {
      await questionRejection({ ...F_Q42, id }, "id de pregunta inválido");
    }
  });

  it("QVAL-03 validateAdminQuestion rejects an empty or non-string question and answer", async () => {
    for (const question of ["", null, 7]) {
      await questionRejection(
        { ...F_Q42, question },
        "texto de pregunta inválido",
      );
    }
    for (const answer of ["", null, 7]) {
      await questionRejection(
        { ...F_Q42, answer },
        "respuesta de la pregunta inválida",
      );
    }
  });

  it("QVAL-04 validateAdminQuestion rejects an empty or non-string wrong_1, wrong_2 and wrong_3", async () => {
    await questionRejection(
      { ...F_Q42, wrong_1: "" },
      "primera opción incorrecta inválida",
    );
    await questionRejection(
      { ...F_Q42, wrong_2: null },
      "segunda opción incorrecta inválida",
    );
    await questionRejection(
      { ...F_Q42, wrong_3: 7 },
      "tercera opción incorrecta inválida",
    );
    expect(validateAdminQuestion(F_Q42)).toEqual(F_Q42);
  });

  it("QVAL-05 validateAdminQuestion rejects a non-string category, source and translation_model", async () => {
    await questionRejection(
      { ...F_Q42, category: 7 },
      "categoría de la pregunta inválida",
    );
    await questionRejection(
      { ...F_Q42, source: {} },
      "origen de la pregunta inválido",
    );
    await questionRejection(
      { ...F_Q42, translation_model: true },
      "modelo de traducción inválido",
    );
    for (const value of [null, ""]) {
      expect(
        validateAdminQuestion({
          ...F_Q42,
          category: value,
          source: value,
          translation_model: value,
        }),
      ).toMatchObject({
        category: value,
        source: value,
        translation_model: value,
      });
    }
  });

  it("QVAL-06 validateAdminQuestion rejects a non-string question_es and answer_es", async () => {
    await questionRejection(
      { ...F_Q42, question_es: 7 },
      "texto de pregunta en español inválido",
    );
    await questionRejection(
      { ...F_Q42, answer_es: [] },
      "respuesta en español inválida",
    );
    await questionRejection(
      { ...F_Q42, question_es: false },
      "texto de pregunta en español inválido",
    );
    for (const value of [null, ""]) {
      expect(
        validateAdminQuestion({
          ...F_Q42,
          question_es: value,
          answer_es: value,
        }),
      ).toMatchObject({ question_es: value, answer_es: value });
    }
  });

  it("QVAL-07 validateAdminQuestion rejects a non-string wrong_1_es, wrong_2_es and wrong_3_es", async () => {
    await questionRejection(
      { ...F_Q42, wrong_1_es: 7 },
      "primera opción incorrecta en español inválida",
    );
    await questionRejection(
      { ...F_Q42, wrong_2_es: {} },
      "segunda opción incorrecta en español inválida",
    );
    await questionRejection(
      { ...F_Q42, wrong_3_es: false },
      "tercera opción incorrecta en español inválida",
    );
    for (const value of [null, ""]) {
      expect(
        validateAdminQuestion({
          ...F_Q42,
          wrong_1_es: value,
          wrong_2_es: value,
          wrong_3_es: value,
        }),
      ).toMatchObject({
        wrong_1_es: value,
        wrong_2_es: value,
        wrong_3_es: value,
      });
    }
  });

  it("QVAL-08 validateAdminQuestion rejects a non-boolean is_translated and is_active", async () => {
    for (const isTranslated of ["true", 0, undefined]) {
      await questionRejection(
        { ...F_Q42, is_translated: isTranslated },
        "indicador de traducción inválido",
      );
    }
    for (const isActive of ["false", 0, undefined]) {
      await questionRejection(
        { ...F_Q42, is_active: isActive },
        "indicador de publicación inválido",
      );
    }
    expect(
      validateAdminQuestion({
        ...F_Q42,
        is_translated: false,
        is_active: false,
      }),
    ).toMatchObject({ is_translated: false, is_active: false });
  });

  it("QVAL-09 validateAdminQuestion accepts null and empty strings and returns the object as received", () => {
    for (const input of [F_Q43, F_Q44]) {
      const output = validateAdminQuestion(input);
      expect(output).toEqual(input);
      expect(output).toBe(input);
    }
  });

  it("QVAL-10 validateAdminQuestion ignores an extra field", () => {
    const input = { ...F_Q42, created_at: "2026-10-26T12:00:00Z" };
    expect(validateAdminQuestion(input)).toEqual(input);
  });

  it("QVAL-11 validateAdminQuestionUpdate rejects a non-object body", async () => {
    for (const input of [null, [], "x", 42]) {
      await updateRejection(input, "respuesta de actualización inválida");
    }
  });

  it("QVAL-12 validateAdminQuestionUpdate rejects a non-array or non-string-item changed_fields", async () => {
    for (const changed_fields of ["question", null, [1], ["question", null]]) {
      await updateRejection(
        { changed_fields, question: F_Q42 },
        "campos cambiados inválidos",
      );
    }
  });

  it("QVAL-13 validateAdminQuestionUpdate accepts changed_fields [] and an unknown name and passes the question detail through", async () => {
    for (const changed_fields of [[], ["foo", "wrong_2"]]) {
      const output = validateAdminQuestionUpdate({
        changed_fields,
        question: F_Q42,
      });
      expect(output.changed_fields).toEqual(changed_fields);
      expect(output.question).toEqual(F_Q42);
    }
    await updateRejection(
      {
        changed_fields: ["wrong_1"],
        question: { ...F_Q42, wrong_1: "" },
      },
      "primera opción incorrecta inválida",
    );
  });

  it("QVAL-14 validateHiddenQuestion rejects a non-object body, an invalid id and is_active true", async () => {
    for (const input of [null, [], "x"]) {
      await hiddenRejection(input, "respuesta de ocultamiento inválida");
    }
    for (const id of [0, -1, 1.5, "42"]) {
      await hiddenRejection(
        { id, is_active: false },
        "id de pregunta inválido",
      );
    }
    await hiddenRejection(
      { id: 42, is_active: true },
      "indicador de publicación inválido",
    );
    await hiddenRejection(
      { id: 42, is_active: "false" },
      "indicador de publicación inválido",
    );
    expect(validateHiddenQuestion({ id: 42, is_active: false })).toEqual({
      id: 42,
      is_active: false,
    });
  });

  it("QVAL-15 validateAdminQuestionEdits rejects a non-array body and a non-object item", async () => {
    for (const input of [null, {}, "x"]) {
      await editsRejection(input, "lista de ediciones inválida");
    }
    for (const item of [null, [], "x"]) {
      await editsRejection([item], "edición inválida");
    }
  });

  it("QVAL-16 validateAdminQuestionEdits rejects each invalid entry field", async () => {
    const edit = {
      id: 9,
      field: "question",
      old_value: "A",
      new_value: "B",
      edited_at: "2026-10-26T12:00:00Z",
    };
    await editsRejection([{ ...edit, id: 0 }], "id de edición inválido");
    await editsRejection([{ ...edit, field: "" }], "campo de edición inválido");
    await editsRejection(
      [{ ...edit, old_value: 0 }],
      "valor anterior inválido",
    );
    await editsRejection([{ ...edit, new_value: {} }], "valor nuevo inválido");
    await editsRejection(
      [{ ...edit, edited_at: "" }],
      "fecha de edición inválida",
    );
  });

  it("QVAL-17 validateAdminQuestionEdits accepts null, empty and raw true/false values, an unknown field and returns a new array in order", () => {
    const input = [
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
        old_value: null,
        new_value: "",
        edited_at: "2026-10-26T14:00:00Z",
      },
    ];
    const output = validateAdminQuestionEdits(input);
    expect(output).toEqual(input);
    expect(output).not.toBe(input);
    expect(output.map((entry) => entry.id)).toEqual([9, 4, 7]);
    expect(output[1].old_value).toBe("false");
    expect(output[1].new_value).toBe("true");
    expect(typeof output[2].edited_at).toBe("string");
    expect(output[2].old_value).toBeNull();
    expect(output[2].new_value).toBe("");
  });
});
