import { describe, expect, it } from "vitest";
import type { AdminQuestion } from "../api/types";
import {
  buildQuestionPatch,
  changedFieldLabels,
  fieldLimit,
  formatHistoryValue,
  QUESTION_EXPORT_REMINDER,
  QUESTION_FIELD_LABELS,
  QUESTION_HISTORY_FIELD_LABELS,
  QUESTION_TEXT_FIELDS,
  questionToDraft,
} from "./questionEditorForm";

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

const F_Q44_OPTIONS: AdminQuestion = {
  ...F_Q43,
  id: 44,
  question: "Capital of Bolivia?",
  answer: "La Paz",
  wrong_1: "Sucre",
  wrong_2: "Santa Cruz",
  wrong_3: "Cochabamba",
  question_es: "",
  answer_es: "La Paz",
  wrong_1_es: "Sucre",
  wrong_2_es: "Santa Cruz",
  wrong_3_es: "Cochabamba",
};

const F_Q45: AdminQuestion = {
  ...F_Q42,
  id: 45,
  answer_es: null,
  wrong_1_es: null,
  wrong_2_es: null,
  wrong_3_es: null,
};

const F_Q42_ESDUP: AdminQuestion = {
  ...F_Q42,
  answer_es: "París",
  wrong_1_es: "Quito",
  wrong_2_es: "Bogotá",
  wrong_3_es: "Santiago",
};

const F_Q43_NULL_OPTION: AdminQuestion = {
  ...F_Q43,
  question_es: "¿Capital del Ecuador?",
  answer_es: "Quito",
  wrong_1_es: "Guayaquil",
  wrong_2_es: "Cuenca",
  wrong_3_es: null,
};

const F_Q43_FILLED: AdminQuestion = {
  ...F_Q43_NULL_OPTION,
  wrong_3_es: "Loja",
};

function draftOf(
  question: AdminQuestion,
  changes: Partial<Record<string, string>>,
) {
  return { ...questionToDraft(question), ...changes };
}

describe("question editor form", () => {
  it("QFORM-01 questionToDraft maps nulls to empty strings and keeps every other value", () => {
    expect(questionToDraft(F_Q42)).toEqual({
      question: "Capital of Peru?",
      answer: "Lima",
      wrong_1: "Quito",
      wrong_2: "Bogotá",
      wrong_3: "Santiago",
      question_es: "¿Capital del Perú?",
      answer_es: "Lima",
      wrong_1_es: "Quito",
      wrong_2_es: "Bogotá",
      wrong_3_es: "Santiago",
    });
    expect(questionToDraft(F_Q43)).toMatchObject({
      question: "Capital of Ecuador?",
      question_es: "",
      answer_es: "",
      wrong_1_es: "",
      wrong_2_es: "",
      wrong_3_es: "",
    });
    expect(questionToDraft(F_Q44_OPTIONS).question_es).toBe("");
    expect(questionToDraft({ ...F_Q42, question: "  padded  " }).question).toBe(
      "  padded  ",
    );
  });

  it("QFORM-02 fieldLimit is 1000 for the two question texts and 300 for the eight options", () => {
    expect(fieldLimit("question")).toBe(1000);
    expect(fieldLimit("question_es")).toBe(1000);
    for (const field of QUESTION_TEXT_FIELDS.filter(
      (name) => name !== "question" && name !== "question_es",
    )) {
      expect(fieldLimit(field)).toBe(300);
    }
  });

  it("QFORM-03 buildQuestionPatch returns patch null when nothing changed", () => {
    expect(buildQuestionPatch(F_Q42, questionToDraft(F_Q42))).toEqual({
      ok: true,
      patch: null,
    });
  });

  it("QFORM-04 buildQuestionPatch treats a whitespace-only edit as no change", () => {
    const result = buildQuestionPatch(
      F_Q42,
      draftOf(F_Q42, { answer: "  Lima  " }),
    );
    expect(result).toEqual({ ok: true, patch: null });
  });

  it("QFORM-05 buildQuestionPatch sends only the one changed field", () => {
    const result = buildQuestionPatch(
      F_Q42,
      draftOf(F_Q42, { wrong_2: "  Arequipa  " }),
    );
    expect(result).toEqual({ ok: true, patch: { wrong_2: "Arequipa" } });
    if (result.ok && result.patch !== null) {
      expect(Object.keys(result.patch)).toEqual(["wrong_2"]);
    }
  });

  it("QFORM-06 buildQuestionPatch rejects an emptied question text with its per-field message", () => {
    expect(
      buildQuestionPatch(F_Q42, draftOf(F_Q42, { question: "   " })),
    ).toEqual({
      ok: false,
      message: "Pregunta en inglés no puede quedar vacía.",
    });
    expect(
      buildQuestionPatch(F_Q42, draftOf(F_Q42, { question_es: "" })),
    ).toEqual({
      ok: false,
      message: "Pregunta en español no puede quedar vacía.",
    });
  });

  it("QFORM-07 buildQuestionPatch rejects an emptied English option with the group message", () => {
    const result = buildQuestionPatch(
      F_Q42,
      draftOf(F_Q42, { wrong_1: "   " }),
    );
    expect(result).toEqual({
      ok: false,
      message: "Completá las cuatro opciones en inglés.",
    });
    expect(JSON.stringify(result)).not.toContain("distintas");
  });

  it("QFORM-08 buildQuestionPatch rejects a loaded null Spanish option with the group message", () => {
    expect(
      buildQuestionPatch(
        F_Q43_NULL_OPTION,
        draftOf(F_Q43_NULL_OPTION, {
          question_es: "¿Capital del Ecuador (país)?",
        }),
      ),
    ).toEqual({
      ok: false,
      message: "Completá las cuatro opciones en español.",
    });

    const completed = buildQuestionPatch(
      F_Q43_NULL_OPTION,
      draftOf(F_Q43_NULL_OPTION, {
        question_es: "¿Capital del Ecuador (país)?",
        wrong_3_es: "Loja",
      }),
    );
    expect(completed).toEqual({
      ok: true,
      patch: {
        question_es: "¿Capital del Ecuador (país)?",
        answer_es: "Quito",
        wrong_1_es: "Guayaquil",
        wrong_2_es: "Cuenca",
        wrong_3_es: "Loja",
      },
    });
  });

  it("QFORM-09 buildQuestionPatch does not check an empty option in a group that is not being sent", () => {
    const withEmptyEnglishOption: AdminQuestion = { ...F_Q42, wrong_1: "" };
    const result = buildQuestionPatch(
      withEmptyEnglishOption,
      draftOf(withEmptyEnglishOption, { answer_es: "Lima, Perú" }),
    );
    expect(result).toEqual({ ok: true, patch: { answer_es: "Lima, Perú" } });
  });

  it("QFORM-10 buildQuestionPatch rejects 1001 question characters and 301 option characters", () => {
    expect(
      buildQuestionPatch(F_Q42, draftOf(F_Q42, { question: "a".repeat(1001) })),
    ).toEqual({
      ok: false,
      message: "Pregunta en inglés no puede superar los 1000 caracteres.",
    });
    expect(
      buildQuestionPatch(F_Q42, draftOf(F_Q42, { wrong_1: "b".repeat(301) })),
    ).toEqual({
      ok: false,
      message:
        "Opción incorrecta 1 en inglés no puede superar los 300 caracteres.",
    });
  });

  it("QFORM-11 buildQuestionPatch accepts exactly 1000 and 300 characters", () => {
    const longQuestion = "a".repeat(1000);
    const longOption = "b".repeat(300);
    expect(
      buildQuestionPatch(F_Q42, draftOf(F_Q42, { question: longQuestion })),
    ).toEqual({ ok: true, patch: { question: longQuestion } });
    expect(
      buildQuestionPatch(F_Q42, draftOf(F_Q42, { wrong_1: longOption })),
    ).toEqual({ ok: true, patch: { wrong_1: longOption } });
  });

  it("QFORM-12 buildQuestionPatch rejects exact duplicate English options in the language being sent", () => {
    const result = buildQuestionPatch(
      F_Q42,
      draftOf(F_Q42, { wrong_1: "Lima" }),
    );
    expect(result).toEqual({
      ok: false,
      message:
        "Las cuatro opciones en inglés tienen que ser distintas entre sí.",
    });
    expect(JSON.stringify(result)).not.toContain("español");
  });

  it("QFORM-13 buildQuestionPatch rejects exact duplicate Spanish options on a translated question", () => {
    expect(
      buildQuestionPatch(F_Q42, draftOf(F_Q42, { wrong_1_es: "Lima" })),
    ).toEqual({
      ok: false,
      message:
        "Las cuatro opciones en español tienen que ser distintas entre sí.",
    });
  });

  it("QFORM-14 buildQuestionPatch rejects París/parís as a case-insensitive Spanish duplicate", () => {
    expect(
      buildQuestionPatch(
        F_Q42_ESDUP,
        draftOf(F_Q42_ESDUP, { wrong_1_es: "parís" }),
      ),
    ).toEqual({
      ok: false,
      message:
        "Las cuatro opciones en español tienen que ser distintas entre sí.",
    });
  });

  it("QFORM-15 buildQuestionPatch rejects LIMA/lima as a case-insensitive English duplicate", () => {
    expect(
      buildQuestionPatch(F_Q42, draftOf(F_Q42, { wrong_1: "LIMA" })),
    ).toEqual({
      ok: false,
      message:
        "Las cuatro opciones en inglés tienen que ser distintas entre sí.",
    });
  });

  it("QFORM-16 buildQuestionPatch gives the group empty message precedence over the duplicate message", () => {
    const result = buildQuestionPatch(
      F_Q42_ESDUP,
      draftOf(F_Q42_ESDUP, { wrong_1_es: "   ", wrong_2_es: "parís" }),
    );
    expect(result).toEqual({
      ok: false,
      message: "Completá las cuatro opciones en español.",
    });
    expect(JSON.stringify(result)).not.toContain("distintas");
  });

  it("QFORM-17 buildQuestionPatch gives a per-field question message precedence over the group empty message", () => {
    expect(
      buildQuestionPatch(F_Q42, draftOf(F_Q42, { question: "", wrong_1: "" })),
    ).toEqual({
      ok: false,
      message: "Pregunta en inglés no puede quedar vacía.",
    });
  });

  it("QFORM-18 buildQuestionPatch reports the group empty message for an untranslated Spanish edit", () => {
    const result = buildQuestionPatch(
      F_Q43,
      draftOf(F_Q43, { question_es: "¿Capital del Ecuador?" }),
    );
    expect(result).toEqual({
      ok: false,
      message: "Completá las cuatro opciones en español.",
    });
    expect(JSON.stringify(result)).not.toContain("completá los cinco");
  });

  it("QFORM-19 buildQuestionPatch reports completeness when only the Spanish question is empty", () => {
    expect(
      buildQuestionPatch(
        F_Q44_OPTIONS,
        draftOf(F_Q44_OPTIONS, { wrong_1_es: "Oruro" }),
      ),
    ).toEqual({
      ok: false,
      message:
        "Para traducir la pregunta, completá los cinco campos en español.",
    });

    const completed = buildQuestionPatch(
      F_Q44_OPTIONS,
      draftOf(F_Q44_OPTIONS, {
        question_es: "¿Capital de Bolivia?",
        wrong_1_es: "Oruro",
      }),
    );
    expect(completed.ok).toBe(true);
    if (completed.ok && completed.patch !== null) {
      expect(Object.keys(completed.patch)).toEqual([
        "question_es",
        "answer_es",
        "wrong_1_es",
        "wrong_2_es",
        "wrong_3_es",
      ]);
    }
  });

  it("QFORM-20 buildQuestionPatch sends the five Spanish fields together in frozen order for an untranslated question", () => {
    const result = buildQuestionPatch(
      F_Q43,
      draftOf(F_Q43, {
        question_es: "  ¿Capital del Ecuador?  ",
        answer_es: "Quito",
        wrong_1_es: "Guayaquil",
        wrong_2_es: "Cuenca",
        wrong_3_es: "Loja",
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok && result.patch !== null) {
      expect(Object.keys(result.patch)).toEqual([
        "question_es",
        "answer_es",
        "wrong_1_es",
        "wrong_2_es",
        "wrong_3_es",
      ]);
      expect(result.patch).toEqual({
        question_es: "¿Capital del Ecuador?",
        answer_es: "Quito",
        wrong_1_es: "Guayaquil",
        wrong_2_es: "Cuenca",
        wrong_3_es: "Loja",
      });
      expect("is_active" in result.patch).toBe(false);
      expect("question" in result.patch).toBe(false);
    }
  });

  it("QFORM-21 buildQuestionPatch adds the five Spanish fields to an English change in frozen order", () => {
    const result = buildQuestionPatch(
      F_Q43,
      draftOf(F_Q43, {
        question: "Capital of Ecuador (country)?",
        question_es: "¿Capital del Ecuador?",
        answer_es: "Quito",
        wrong_1_es: "Guayaquil",
        wrong_2_es: "Cuenca",
        wrong_3_es: "Loja",
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok && result.patch !== null) {
      expect(Object.keys(result.patch)).toEqual([
        "question",
        "question_es",
        "answer_es",
        "wrong_1_es",
        "wrong_2_es",
        "wrong_3_es",
      ]);
    }
  });

  it("QFORM-22 buildQuestionPatch sends one Spanish key for a translated question", () => {
    const result = buildQuestionPatch(
      F_Q42,
      draftOf(F_Q42, { answer_es: "Lima, Perú" }),
    );
    expect(result).toEqual({ ok: true, patch: { answer_es: "Lima, Perú" } });
    if (result.ok && result.patch !== null) {
      expect(Object.keys(result.patch)).toEqual(["answer_es"]);
    }
  });

  it("QFORM-23 buildQuestionPatch rejects one Spanish change on a translated question whose Spanish options are null", () => {
    expect(
      buildQuestionPatch(F_Q45, draftOf(F_Q45, { answer_es: "Lima, Perú" })),
    ).toEqual({
      ok: false,
      message: "Completá las cuatro opciones en español.",
    });
  });

  it("QFORM-24 buildQuestionPatch does not distinctness-check an unchanged language", () => {
    const duplicatedEnglish: AdminQuestion = { ...F_Q42, wrong_1: "Lima" };
    expect(
      buildQuestionPatch(
        duplicatedEnglish,
        draftOf(duplicatedEnglish, { answer_es: "Lima, Perú" }),
      ),
    ).toEqual({ ok: true, patch: { answer_es: "Lima, Perú" } });
  });

  it("QFORM-25 changedFieldLabels maps known fields in server order", () => {
    expect(changedFieldLabels(["question", "wrong_2"])).toBe(
      "Pregunta en inglés, Opción incorrecta 2 en inglés",
    );
  });

  it('QFORM-26 changedFieldLabels renders an unknown field raw and returns "" for an empty array', () => {
    expect(changedFieldLabels(["foo", "wrong_2"])).toBe(
      "foo, Opción incorrecta 2 en inglés",
    );
    expect(changedFieldLabels([])).toBe("");
  });

  it("QFORM-27 changedFieldLabels includes is_active as Visibilidad", () => {
    expect(changedFieldLabels(["answer_es"])).toBe("Respuesta en español");
    expect(changedFieldLabels(["is_active"])).toBe("Visibilidad");
  });

  it("QFORM-28 QUESTION_TEXT_FIELDS and QUESTION_FIELD_LABELS are the frozen order and copy", () => {
    expect(QUESTION_TEXT_FIELDS).toEqual([
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
    ]);
    expect(
      QUESTION_TEXT_FIELDS.map((field) => QUESTION_FIELD_LABELS[field]),
    ).toEqual([
      "Pregunta en inglés",
      "Respuesta en inglés",
      "Opción incorrecta 1 en inglés",
      "Opción incorrecta 2 en inglés",
      "Opción incorrecta 3 en inglés",
      "Pregunta en español",
      "Respuesta en español",
      "Opción incorrecta 1 en español",
      "Opción incorrecta 2 en español",
      "Opción incorrecta 3 en español",
    ]);
    expect(QUESTION_HISTORY_FIELD_LABELS.is_active).toBe("Visibilidad");
  });

  it("QFORM-29 QUESTION_EXPORT_REMINDER is exactly the verified sentence", () => {
    expect(QUESTION_EXPORT_REMINDER).toBe(
      "Para que esta corrección sobreviva a una recarga de la base, corré: poetry run python -m app.export_admin_edits",
    );
  });

  it("QFORM-30 an English-only change on an untranslated question sends one key", () => {
    expect(
      buildQuestionPatch(
        F_Q43,
        draftOf(F_Q43, { question: "Capital of Ecuador (country)?" }),
      ),
    ).toEqual({
      ok: true,
      patch: { question: "Capital of Ecuador (country)?" },
    });
  });

  it("QFORM-31 an untranslated question with only one Spanish change still sends all five fields", () => {
    const result = buildQuestionPatch(
      F_Q43_FILLED,
      draftOf(F_Q43_FILLED, { answer_es: "Quito, Ecuador" }),
    );
    expect(result.ok).toBe(true);
    if (result.ok && result.patch !== null) {
      expect(Object.keys(result.patch)).toEqual([
        "question_es",
        "answer_es",
        "wrong_1_es",
        "wrong_2_es",
        "wrong_3_es",
      ]);
      expect(result.patch.answer_es).toBe("Quito, Ecuador");
      expect(result.patch.question_es).toBe("¿Capital del Ecuador?");
    }
  });

  it("QFORM-32 formatHistoryValue renders is_active true as Visible", () => {
    expect(formatHistoryValue("is_active", "true")).toBe("Visible");
  });

  it("QFORM-33 formatHistoryValue renders is_active false as Oculta", () => {
    expect(formatHistoryValue("is_active", "false")).toBe("Oculta");
  });

  it("QFORM-34 formatHistoryValue renders null as Sin valor for any field", () => {
    expect(formatHistoryValue("is_active", null)).toBe("Sin valor");
    expect(formatHistoryValue("wrong_1", null)).toBe("Sin valor");
  });

  it("QFORM-35 formatHistoryValue renders an empty string as an empty value, not Sin valor", () => {
    expect(formatHistoryValue("answer_es", "")).toBe("");
    expect(formatHistoryValue("is_active", "")).toBe("");
    expect(formatHistoryValue("is_active", "")).not.toBe("Oculta");
  });

  it("QFORM-36 formatHistoryValue renders an unknown is_active value raw", () => {
    expect(formatHistoryValue("is_active", "True")).toBe("True");
  });

  it("QFORM-37 formatHistoryValue renders another field's true raw", () => {
    expect(formatHistoryValue("question", "true")).toBe("true");
    expect(formatHistoryValue("answer", "false")).toBe("false");
  });

  it("QFORM-38 formatHistoryValue renders an unknown field's value raw", () => {
    expect(formatHistoryValue("foo", "false")).toBe("false");
    expect(formatHistoryValue("foo", "bar")).toBe("bar");
  });
});
