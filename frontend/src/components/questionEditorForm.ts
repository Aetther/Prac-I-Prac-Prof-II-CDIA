import type {
  AdminQuestion,
  AdminQuestionPatch,
  AdminQuestionTextField,
} from "../api/types";

export type QuestionDraft = Record<AdminQuestionTextField, string>;

export const QUESTION_TEXT_FIELDS: readonly AdminQuestionTextField[] =
  Object.freeze([
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

export const QUESTION_FIELD_LABELS: Record<AdminQuestionTextField, string> = {
  question: "Pregunta en inglés",
  answer: "Respuesta en inglés",
  wrong_1: "Opción incorrecta 1 en inglés",
  wrong_2: "Opción incorrecta 2 en inglés",
  wrong_3: "Opción incorrecta 3 en inglés",
  question_es: "Pregunta en español",
  answer_es: "Respuesta en español",
  wrong_1_es: "Opción incorrecta 1 en español",
  wrong_2_es: "Opción incorrecta 2 en español",
  wrong_3_es: "Opción incorrecta 3 en español",
};

export const QUESTION_HISTORY_FIELD_LABELS: Record<string, string> = {
  ...QUESTION_FIELD_LABELS,
  is_active: "Visibilidad",
};

export const QUESTION_EXPORT_REMINDER =
  "Para que esta corrección sobreviva a una recarga de la base, corré: poetry run python -m app.export_admin_edits";

const ENGLISH_FIELDS: readonly AdminQuestionTextField[] = [
  "question",
  "answer",
  "wrong_1",
  "wrong_2",
  "wrong_3",
];

const SPANISH_FIELDS: readonly AdminQuestionTextField[] = [
  "question_es",
  "answer_es",
  "wrong_1_es",
  "wrong_2_es",
  "wrong_3_es",
];

const ENGLISH_OPTIONS: readonly AdminQuestionTextField[] = [
  "answer",
  "wrong_1",
  "wrong_2",
  "wrong_3",
];

const SPANISH_OPTIONS: readonly AdminQuestionTextField[] = [
  "answer_es",
  "wrong_1_es",
  "wrong_2_es",
  "wrong_3_es",
];

const QUESTION_TEXT_LIMIT = 1000;
const OPTION_TEXT_LIMIT = 300;

function isDistinct(
  options: readonly AdminQuestionTextField[],
  values: Record<AdminQuestionTextField, string>,
  locale: "en" | "es",
): boolean {
  const normalized = options.map((field) =>
    values[field].toLocaleLowerCase(locale),
  );
  return new Set(normalized).size === normalized.length;
}

export function questionToDraft(question: AdminQuestion): QuestionDraft {
  const draft = {} as QuestionDraft;
  for (const field of QUESTION_TEXT_FIELDS) {
    draft[field] = question[field] ?? "";
  }
  return draft;
}

export function fieldLimit(field: AdminQuestionTextField): 1000 | 300 {
  return field === "question" || field === "question_es"
    ? QUESTION_TEXT_LIMIT
    : OPTION_TEXT_LIMIT;
}

export function buildQuestionPatch(
  question: AdminQuestion,
  draft: QuestionDraft,
):
  | { ok: true; patch: AdminQuestionPatch | null }
  | { ok: false; message: string } {
  const trimmed = {} as Record<AdminQuestionTextField, string>;
  for (const field of QUESTION_TEXT_FIELDS) {
    trimmed[field] = draft[field].trim();
  }

  const changed = QUESTION_TEXT_FIELDS.filter(
    (field) => trimmed[field] !== (question[field] ?? "").trim(),
  );
  if (changed.length === 0) {
    return { ok: true, patch: null };
  }

  for (const field of changed) {
    if (
      (field === "question" || field === "question_es") &&
      trimmed[field] === ""
    ) {
      return {
        ok: false,
        message: `${QUESTION_FIELD_LABELS[field]} no puede quedar vacía.`,
      };
    }
    const limit = fieldLimit(field);
    if (trimmed[field].length > limit) {
      return {
        ok: false,
        message: `${QUESTION_FIELD_LABELS[field]} no puede superar los ${limit} caracteres.`,
      };
    }
  }

  const englishBeingSent = ENGLISH_FIELDS.some((field) =>
    changed.includes(field),
  );
  const spanishBeingSent = SPANISH_FIELDS.some((field) =>
    changed.includes(field),
  );

  if (
    englishBeingSent &&
    ENGLISH_OPTIONS.some((field) => trimmed[field] === "")
  ) {
    return { ok: false, message: "Completá las cuatro opciones en inglés." };
  }
  if (
    spanishBeingSent &&
    SPANISH_OPTIONS.some((field) => trimmed[field] === "")
  ) {
    return { ok: false, message: "Completá las cuatro opciones en español." };
  }

  if (
    question.is_translated === false &&
    spanishBeingSent &&
    SPANISH_FIELDS.some((field) => trimmed[field] === "")
  ) {
    return {
      ok: false,
      message:
        "Para traducir la pregunta, completá los cinco campos en español.",
    };
  }

  if (englishBeingSent && !isDistinct(ENGLISH_OPTIONS, trimmed, "en")) {
    return {
      ok: false,
      message:
        "Las cuatro opciones en inglés tienen que ser distintas entre sí.",
    };
  }
  if (spanishBeingSent && !isDistinct(SPANISH_OPTIONS, trimmed, "es")) {
    return {
      ok: false,
      message:
        "Las cuatro opciones en español tienen que ser distintas entre sí.",
    };
  }

  const fieldsToSend = new Set<AdminQuestionTextField>(changed);
  if (question.is_translated === false && spanishBeingSent) {
    for (const field of SPANISH_FIELDS) {
      fieldsToSend.add(field);
    }
  }

  const patch: AdminQuestionPatch = {};
  for (const field of QUESTION_TEXT_FIELDS) {
    if (fieldsToSend.has(field)) {
      patch[field] = trimmed[field];
    }
  }
  return { ok: true, patch };
}

export function changedFieldLabels(fields: readonly string[]): string {
  return fields
    .map((field) => QUESTION_HISTORY_FIELD_LABELS[field] ?? field)
    .join(", ");
}
