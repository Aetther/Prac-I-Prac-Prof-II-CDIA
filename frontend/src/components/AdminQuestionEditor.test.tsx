import { afterEach, describe, expect, it, vi } from "vitest";
import { createRef } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AdminFailure } from "../api/adminFailures";
import type { AdminQuestion, AdminQuestionEdit } from "../api/types";
import { AdminQuestionEditor } from "./AdminQuestionEditor";
import { QUESTION_EXPORT_REMINDER } from "./questionEditorForm";

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

const F_Q42_ESDUP: AdminQuestion = {
  ...F_Q42,
  answer_es: "París",
};

const H_ORDER: AdminQuestionEdit[] = [
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

const H_NULL: AdminQuestionEdit[] = [
  {
    id: 11,
    field: "wrong_1",
    old_value: null,
    new_value: "Lima",
    edited_at: "2026-10-26T15:00:00Z",
  },
  {
    id: 12,
    field: "answer_es",
    old_value: "",
    new_value: "Lima",
    edited_at: "2026-10-26T16:00:00Z",
  },
];

const H_BAD: AdminQuestionEdit[] = [
  {
    id: 14,
    field: "question",
    old_value: "A",
    new_value: "B",
    edited_at: "no es una fecha",
  },
];

const H_HTML: AdminQuestionEdit[] = [
  {
    id: 13,
    field: "answer",
    old_value: "Lima",
    new_value: "<b>Lima</b>",
    edited_at: "2026-10-26T17:00:00Z",
  },
];

interface EditorOverrides {
  questionId?: number;
  state?: "loading" | "ready";
  question?: AdminQuestion | null;
  edits?: readonly AdminQuestionEdit[] | null;
  editsLoading?: boolean;
  editsFailure?: AdminFailure | null;
  busy?: boolean;
  failure?: AdminFailure | null;
  statusMessage?: string | null;
  showReminder?: boolean;
}

function makeSpies() {
  return {
    onSave: vi.fn(),
    onHide: vi.fn(),
    onRestore: vi.fn(),
    onClose: vi.fn(),
    onRetry: vi.fn(),
    onRetryEdits: vi.fn(),
  };
}

function buildProps(
  overrides: EditorOverrides,
  spies: ReturnType<typeof makeSpies>,
) {
  return {
    questionId: overrides.questionId ?? 42,
    state: overrides.state ?? ("ready" as const),
    question: overrides.question === undefined ? F_Q42 : overrides.question,
    edits: overrides.edits === undefined ? [] : overrides.edits,
    editsLoading: overrides.editsLoading ?? false,
    editsFailure: overrides.editsFailure ?? null,
    busy: overrides.busy ?? false,
    failure: overrides.failure ?? null,
    statusMessage: overrides.statusMessage ?? null,
    showReminder: overrides.showReminder ?? false,
    headingRef: createRef<HTMLHeadingElement>(),
    historyHeadingRef: createRef<HTMLHeadingElement>(),
    ...spies,
  };
}

function renderEditor(overrides: EditorOverrides = {}) {
  const spies = makeSpies();
  const view = render(
    <AdminQuestionEditor {...buildProps(overrides, spies)} />,
  );
  const rerenderEditor = (next: EditorOverrides) => {
    view.rerender(
      <AdminQuestionEditor {...buildProps({ ...overrides, ...next }, spies)} />,
    );
  };
  return { ...view, ...spies, rerenderEditor };
}

function field(label: string): HTMLInputElement {
  return screen.getByLabelText(label) as HTMLInputElement;
}

function region(): HTMLElement {
  return screen.getByRole("region", { name: "Editar pregunta 42" });
}

function counterOf(label: string): HTMLElement {
  const describedBy = field(label).getAttribute("aria-describedby");
  const counter = document.getElementById(String(describedBy));
  if (counter === null) {
    throw new Error(`no counter for ${label}`);
  }
  return counter;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AdminQuestionEditor", () => {
  it("QEDIT-01 renders the region, heading and question loading status while loading", () => {
    const { rerenderEditor } = renderEditor({
      state: "loading",
      question: null,
      edits: null,
    });

    const section = region();
    const heading = within(section).getByRole("heading", {
      name: "Editar pregunta 42",
    });
    expect(heading).toHaveAttribute("tabindex", "-1");
    expect(within(section).getByRole("status")).toHaveTextContent(
      "Cargando pregunta...",
    );
    expect(within(section).queryByRole("form")).not.toBeInTheDocument();
    expect(within(section).queryByText("Id")).not.toBeInTheDocument();
    expect(
      within(section).queryByText("Historial de ediciones"),
    ).not.toBeInTheDocument();

    rerenderEditor({ state: "ready", question: F_Q42, edits: [] });
    expect(within(region()).getByRole("form")).toBeVisible();
    expect(
      within(region()).queryByText("Cargando pregunta..."),
    ).not.toBeInTheDocument();
  });

  it("QEDIT-02 renders the read-only block from the loaded question", () => {
    renderEditor();

    const facts = region().querySelector("dl");
    expect(facts).not.toBeNull();
    const block = facts as HTMLElement;
    expect(within(block).getByText("Id").nextElementSibling).toHaveTextContent(
      "42",
    );
    expect(
      within(block).getByText("Categoría").nextElementSibling,
    ).toHaveTextContent("geografia");
    expect(
      within(block).getByText("Origen").nextElementSibling,
    ).toHaveTextContent("ia");
    expect(
      within(block).getByText("Modelo de traducción").nextElementSibling,
    ).toHaveTextContent("gpt-4.1-mini");
    expect(
      within(block).getByText("Estado de traducción").nextElementSibling,
    ).toHaveTextContent("Traducida");
    expect(
      within(block).getByText("Visibilidad").nextElementSibling,
    ).toHaveTextContent("Visible");
  });

  it("QEDIT-03 shows Sin valor for each null or empty read-only value and the hidden flags", () => {
    const { rerenderEditor } = renderEditor({ question: F_Q43 });

    const block = region().querySelector("dl") as HTMLElement;
    expect(
      within(block).getByText("Modelo de traducción").nextElementSibling,
    ).toHaveTextContent("Sin valor");
    expect(
      within(block).getByText("Estado de traducción").nextElementSibling,
    ).toHaveTextContent("Sin traducir");
    expect(
      within(block).getByText("Visibilidad").nextElementSibling,
    ).toHaveTextContent("Oculta");
    expect(
      screen.getByRole("button", { name: "Volver a mostrar" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Ocultar pregunta" }),
    ).not.toBeInTheDocument();
    expect(field("Pregunta en español").value).toBe("");

    rerenderEditor({
      question: { ...F_Q43, category: "", source: "", translation_model: "" },
    });
    const emptyBlock = region().querySelector("dl") as HTMLElement;
    for (const term of ["Categoría", "Origen", "Modelo de traducción"]) {
      expect(
        within(emptyBlock).getByText(term).nextElementSibling,
      ).toHaveTextContent("Sin valor");
    }
    expect(field("Pregunta en español").value).toBe("");
  });

  it("QEDIT-04 renders the two fieldsets and all ten labelled fields with the loaded values", () => {
    renderEditor();

    const english = screen.getByRole("group", { name: "Inglés" });
    const spanish = screen.getByRole("group", { name: "Español" });
    expect(english).toBeVisible();
    expect(spanish).toBeVisible();
    const values: [string, string][] = [
      ["Pregunta en inglés", "Capital of Peru?"],
      ["Respuesta en inglés", "Lima"],
      ["Opción incorrecta 1 en inglés", "Quito"],
      ["Opción incorrecta 2 en inglés", "Bogotá"],
      ["Opción incorrecta 3 en inglés", "Santiago"],
      ["Pregunta en español", "¿Capital del Perú?"],
      ["Respuesta en español", "Lima"],
      ["Opción incorrecta 1 en español", "Quito"],
      ["Opción incorrecta 2 en español", "Bogotá"],
      ["Opción incorrecta 3 en español", "Santiago"],
    ];
    for (const [label, value] of values) {
      expect(field(label).value).toBe(value);
    }
  });

  it("QEDIT-05 counters show the trimmed length and no field sets maxLength", async () => {
    const user = userEvent.setup();
    renderEditor();

    expect(counterOf("Pregunta en inglés")).toHaveTextContent("16/1000");
    expect(counterOf("Respuesta en inglés")).toHaveTextContent("4/300");

    const answer = field("Respuesta en inglés");
    await user.clear(answer);
    await user.type(answer, "  Lim  ");
    expect(counterOf("Respuesta en inglés")).toHaveTextContent("3/300");

    for (const label of [
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
    ]) {
      expect(field(label)).not.toHaveAttribute("maxlength");
    }
  });

  it("QEDIT-06 the counter recomputes the trimmed length on every keystroke", () => {
    renderEditor();
    const question = field("Pregunta en inglés");
    expect(counterOf("Pregunta en inglés")).toHaveTextContent("16/1000");

    fireEvent.change(question, { target: { value: "a".repeat(1001) } });

    expect(counterOf("Pregunta en inglés")).toHaveTextContent("1001/1000");
    expect(question.value).toHaveLength(1001);
  });

  it("QEDIT-07 Guardando... and a disabled save button while busy", () => {
    const { rerenderEditor, onSave } = renderEditor({ busy: true });

    const busySave = screen.getByRole("button", { name: "Guardando..." });
    expect(busySave).toBeDisabled();
    expect(busySave).toHaveClass("button-primary", "touch-target");
    fireEvent.click(busySave);
    expect(onSave).not.toHaveBeenCalled();

    rerenderEditor({ busy: false });
    const save = screen.getByRole("button", { name: "Guardar cambios" });
    expect(save).toHaveClass("button-primary", "touch-target");
    expect(save).toBeEnabled();
  });

  it("QEDIT-08 an emptied question text shows its per-field message and never calls onSave", async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor();

    await user.clear(field("Pregunta en inglés"));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Pregunta en inglés no puede quedar vacía.",
    );

    fireEvent.change(field("Pregunta en inglés"), {
      target: { value: "   " },
    });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Pregunta en inglés no puede quedar vacía.",
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it("QEDIT-09 an over-limit question text shows its exact message and the 1000-character control saves", () => {
    const { onSave } = renderEditor();

    fireEvent.change(field("Pregunta en inglés"), {
      target: { value: "a".repeat(1001) },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Pregunta en inglés no puede superar los 1000 caracteres.",
    );
    expect(field("Pregunta en inglés").value).toHaveLength(1001);
    expect(onSave).not.toHaveBeenCalled();

    const atLimit = "a".repeat(1000);
    fireEvent.change(field("Pregunta en inglés"), {
      target: { value: atLimit },
    });
    expect(counterOf("Pregunta en inglés")).toHaveTextContent("1000/1000");
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({ question: atLimit });
  });

  it("QEDIT-10 an emptied option shows the group message and never calls onSave", () => {
    const { onSave } = renderEditor();

    fireEvent.change(field("Opción incorrecta 1 en inglés"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Completá las cuatro opciones en inglés.");
    expect(alert).not.toHaveTextContent("distintas");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("QEDIT-11 a case-insensitive duplicate option shows the language message and never calls onSave", () => {
    const first = renderEditor();
    fireEvent.change(field("Opción incorrecta 1 en inglés"), {
      target: { value: "LIMA" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Las cuatro opciones en inglés tienen que ser distintas entre sí.",
    );
    expect(first.onSave).not.toHaveBeenCalled();
    first.unmount();

    const second = renderEditor({ question: F_Q42_ESDUP });
    fireEvent.change(field("Opción incorrecta 1 en español"), {
      target: { value: "parís" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Las cuatro opciones en español tienen que ser distintas entre sí.",
    );
    expect(second.onSave).not.toHaveBeenCalled();
  });

  it("QEDIT-12 the group empty message wins over a duplicate and never calls onSave", () => {
    const { onSave } = renderEditor({ question: F_Q42_ESDUP });

    fireEvent.change(field("Opción incorrecta 1 en español"), {
      target: { value: "   " },
    });
    fireEvent.change(field("Opción incorrecta 2 en español"), {
      target: { value: "parís" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Completá las cuatro opciones en español.");
    expect(alert).not.toHaveTextContent("distintas");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("QEDIT-13 an untranslated Spanish edit starts with the group empty message", async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor({ question: F_Q43 });

    fireEvent.change(field("Pregunta en español"), {
      target: { value: "¿Capital del Ecuador?" },
    });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Completá las cuatro opciones en español.");
    expect(alert).not.toHaveTextContent("completá los cinco");
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.change(field("Respuesta en español"), {
      target: { value: "Quito" },
    });
    fireEvent.change(field("Opción incorrecta 1 en español"), {
      target: { value: "Guayaquil" },
    });
    fireEvent.change(field("Opción incorrecta 2 en español"), {
      target: { value: "Cuenca" },
    });
    fireEvent.change(field("Opción incorrecta 3 en español"), {
      target: { value: "Loja" },
    });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({
      question_es: "¿Capital del Ecuador?",
      answer_es: "Quito",
      wrong_1_es: "Guayaquil",
      wrong_2_es: "Cuenca",
      wrong_3_es: "Loja",
    });
  });

  it("QEDIT-14 the completeness message covers an empty Spanish question", async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor({ question: F_Q44_OPTIONS });

    fireEvent.change(field("Opción incorrecta 1 en español"), {
      target: { value: "Oruro" },
    });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Para traducir la pregunta, completá los cinco campos en español.",
    );
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.change(field("Pregunta en español"), {
      target: { value: "¿Capital de Bolivia?" },
    });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({
      question_es: "¿Capital de Bolivia?",
      answer_es: "La Paz",
      wrong_1_es: "Oruro",
      wrong_2_es: "Santa Cruz",
      wrong_3_es: "Cochabamba",
    });
  });

  it("QEDIT-15 submitting with nothing changed calls onSave(null) once", async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor();

    fireEvent.change(field("Respuesta en inglés"), {
      target: { value: "  Lima  " },
    });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(null);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("QEDIT-16 submitting one change calls onSave once with the built patch", async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor();

    fireEvent.change(field("Opción incorrecta 2 en inglés"), {
      target: { value: "  Arequipa  " },
    });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({ wrong_2: "Arequipa" });
  });

  it("QEDIT-17 Ocultar pregunta opens the group, fires nothing and Cancelar restores focus", async () => {
    const user = userEvent.setup();
    const { onHide } = renderEditor();

    await user.click(screen.getByRole("button", { name: "Ocultar pregunta" }));
    const group = screen.getByRole("group", {
      name: "Confirmar ocultar la pregunta 42",
    });
    expect(
      within(group).getByText(
        "¿Ocultar la pregunta? El juego deja de mostrarla.",
      ),
    ).toBeVisible();
    expect(
      within(group).getByRole("button", { name: "Confirmar ocultar" }),
    ).toBeVisible();
    expect(
      within(group).getByRole("button", { name: "Cancelar" }),
    ).toBeVisible();
    expect(onHide).not.toHaveBeenCalled();

    await user.click(within(group).getByRole("button", { name: "Cancelar" }));
    expect(
      screen.queryByRole("group", { name: "Confirmar ocultar la pregunta 42" }),
    ).not.toBeInTheDocument();
    expect(onHide).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Ocultar pregunta" }),
    );
  });

  it("QEDIT-18 Confirmar ocultar calls onHide once, closes the group and a second activation sends nothing", async () => {
    const user = userEvent.setup();
    const { onHide } = renderEditor();

    await user.click(screen.getByRole("button", { name: "Ocultar pregunta" }));
    await user.click(screen.getByRole("button", { name: "Confirmar ocultar" }));
    expect(onHide).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("group", { name: "Confirmar ocultar la pregunta 42" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ocultar pregunta" }));
    expect(onHide).toHaveBeenCalledTimes(1);
  });

  it("QEDIT-19 Volver a mostrar calls onRestore once with no confirmation group", async () => {
    const user = userEvent.setup();
    const { onRestore } = renderEditor({ question: F_Q43 });

    expect(screen.getByText("Oculta")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Ocultar pregunta" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Volver a mostrar" }));

    expect(onRestore).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("group", { name: "Confirmar ocultar la pregunta 43" }),
    ).not.toBeInTheDocument();
  });

  it("QEDIT-20 the status message and the exact reminder render in order", () => {
    renderEditor({
      statusMessage: "Campos guardados: Opción incorrecta 2 en inglés.",
      showReminder: true,
    });

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(
      "Campos guardados: Opción incorrecta 2 en inglés.",
    );
    const reminder = screen.getByText(QUESTION_EXPORT_REMINDER);
    expect(reminder.tagName).toBe("P");
    expect(
      status.compareDocumentPosition(reminder) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("QEDIT-21 no reminder renders before any write or when the prop is false", () => {
    const { rerenderEditor } = renderEditor({
      statusMessage: "No se guardó ningún cambio.",
      showReminder: false,
    });

    expect(screen.getByRole("status")).toHaveTextContent(
      "No se guardó ningún cambio.",
    );
    expect(
      screen.queryByText(QUESTION_EXPORT_REMINDER),
    ).not.toBeInTheDocument();

    rerenderEditor({ statusMessage: null, showReminder: false });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(
      screen.queryByText(QUESTION_EXPORT_REMINDER),
    ).not.toBeInTheDocument();
  });

  it("QEDIT-22 the history shows Cargando historial... while its request is pending", () => {
    renderEditor({ edits: null, editsLoading: true });

    expect(
      screen.getByRole("heading", { name: "Historial de ediciones" }),
    ).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Cargando historial...",
    );
    expect(
      screen.getByRole("button", { name: "Guardar cambios" }),
    ).toBeEnabled();
    expect(screen.getByRole("form")).toBeVisible();
  });

  it("QEDIT-23 a history failure renders its own alert with the mapped message", () => {
    renderEditor({
      edits: null,
      editsFailure: {
        kind: "error",
        message: "Error del servidor.",
        retryable: true,
      },
    });

    const alerts = within(region()).getAllByRole("alert");
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent("No se pudo cargar el historial.");
    expect(alerts[0]).toHaveTextContent("Error del servidor.");
    expect(
      screen.getByRole("button", { name: "Reintentar el historial" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Guardar cambios" }),
    ).toBeEnabled();
  });

  it("QEDIT-24 Reintentar el historial calls onRetryEdits once and shows the loading state", async () => {
    const user = userEvent.setup();
    const { onRetryEdits, onRetry, onSave, rerenderEditor } = renderEditor({
      edits: null,
      editsFailure: {
        kind: "error",
        message: "Error del servidor.",
        retryable: true,
      },
    });

    await user.click(
      screen.getByRole("button", { name: "Reintentar el historial" }),
    );
    expect(onRetryEdits).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();

    rerenderEditor({ editsLoading: true, editsFailure: null });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Cargando historial...",
    );
    expect(
      screen.getByRole("button", { name: "Guardar cambios" }),
    ).toBeEnabled();
  });

  it("QEDIT-25 history renders in the returned order with labels, the Visible/Oculta vocabulary and the empty-string rule", () => {
    renderEditor({ edits: [...H_ORDER, ...H_NULL] });

    const list = screen.getByRole("list");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(5);
    expect(items[0]).toHaveTextContent("Campo: Pregunta en inglés");
    expect(items[1]).toHaveTextContent("Campo: Visibilidad");
    expect(items[2]).toHaveTextContent("Campo: foo");
    expect(items[3]).toHaveTextContent("Campo: Opción incorrecta 1 en inglés");
    expect(items[4]).toHaveTextContent("Campo: Respuesta en español");

    expect(items[1]).toHaveTextContent("Antes: Oculta");
    expect(items[1]).toHaveTextContent("Después: Visible");
    expect(items[1]).not.toHaveTextContent("Antes: false");
    expect(items[1]).not.toHaveTextContent("Después: true");
    expect(items[3]).toHaveTextContent("Antes: Sin valor");
    expect(items[3]).toHaveTextContent("Después: Lima");
    expect(within(items[4]).getByText("Antes:")).toBeInTheDocument();
    expect(items[4]).not.toHaveTextContent("Antes: Sin valor");
  });

  it("QEDIT-26 history timestamps render the Buenos Aires literal inside a raw time dateTime", () => {
    const { rerenderEditor } = renderEditor({ edits: H_ORDER });

    const first = screen.getByText("26/10/26, 9:00 a. m.");
    expect(first.tagName).toBe("TIME");
    expect(first).toHaveAttribute("datetime", "2026-10-26T12:00:00Z");
    expect(screen.getByText("26/10/26, 10:00 a. m.")).toBeVisible();
    expect(screen.getByText("26/10/26, 11:00 a. m.")).toBeVisible();

    rerenderEditor({ edits: H_BAD });
    const bad = screen.getByText("no es una fecha");
    expect(bad.tagName).toBe("TIME");
    expect(bad).toHaveAttribute("datetime", "no es una fecha");
    expect(screen.queryByText("Invalid Date")).not.toBeInTheDocument();
  });

  it("QEDIT-27 an empty history renders Sin ediciones registradas. and no list", () => {
    renderEditor({ edits: [] });

    expect(screen.getByText("Sin ediciones registradas.")).toBeVisible();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("QEDIT-28 history values containing HTML render as text", () => {
    const { container, rerenderEditor } = renderEditor({ edits: H_HTML });

    expect(screen.getByText("Después: <b>Lima</b>")).toBeVisible();
    expect(container.querySelector("b")).toBeNull();

    rerenderEditor({
      edits: [],
      question: {
        ...F_Q42,
        question: "<b>Capital</b> of Peru?",
        wrong_1: "<i>Quito</i>",
      },
    });
    expect(field("Pregunta en inglés").value).toBe("<b>Capital</b> of Peru?");
    expect(field("Opción incorrecta 1 en inglés").value).toBe("<i>Quito</i>");
    expect(region().querySelector("b")).toBeNull();
    expect(region().querySelector("i")).toBeNull();
  });

  it("QEDIT-29 a server failure renders the message, the detail only for 422 and Reintentar only when retryable", async () => {
    const user = userEvent.setup();
    const first = renderEditor({
      failure: {
        kind: "error",
        message: "El cambio no es válido.",
        detail: "las opciones deben ser distintas",
        retryable: false,
      },
    });
    const detailed = within(region()).getByRole("alert");
    expect(detailed).toHaveTextContent("El cambio no es válido.");
    expect(detailed).toHaveTextContent("las opciones deben ser distintas");
    expect(
      within(detailed).queryByRole("button", { name: "Reintentar" }),
    ).not.toBeInTheDocument();
    first.unmount();

    const second = renderEditor({
      failure: {
        kind: "error",
        message: "Error del servidor.",
        retryable: true,
      },
    });
    const retryable = within(region()).getByRole("alert");
    expect(retryable).toHaveTextContent("Error del servidor.");
    expect(retryable.querySelectorAll("p")).toHaveLength(1);
    await user.click(
      within(retryable).getByRole("button", { name: "Reintentar" }),
    );
    expect(second.onRetry).toHaveBeenCalledTimes(1);
    second.unmount();

    renderEditor({
      failure: {
        kind: "error",
        message: "Respuesta inválida del servidor.",
        detail: "primera opción incorrecta inválida",
        retryable: false,
      },
    });
    expect(within(region()).getByRole("alert")).toHaveTextContent(
      "primera opción incorrecta inválida",
    );
  });

  it("QEDIT-30 every editor control carries touch-target", async () => {
    const user = userEvent.setup();
    const retryable = {
      kind: "error" as const,
      message: "Error del servidor.",
      retryable: true,
    };
    const visible = renderEditor({
      edits: null,
      editsFailure: retryable,
      failure: retryable,
    });
    const hideControl = screen.getByRole("button", {
      name: "Ocultar pregunta",
    });
    const editorRetry = screen.getByRole("button", { name: "Reintentar" });
    await user.click(hideControl);

    const controls: HTMLElement[] = [
      screen.getByRole("button", { name: "Cerrar" }),
      field("Pregunta en inglés"),
      field("Respuesta en inglés"),
      field("Opción incorrecta 1 en inglés"),
      field("Opción incorrecta 2 en inglés"),
      field("Opción incorrecta 3 en inglés"),
      field("Pregunta en español"),
      field("Respuesta en español"),
      field("Opción incorrecta 1 en español"),
      field("Opción incorrecta 2 en español"),
      field("Opción incorrecta 3 en español"),
      screen.getByRole("button", { name: "Guardar cambios" }),
      screen.getByRole("button", { name: "Confirmar ocultar" }),
      screen.getByRole("button", { name: "Cancelar" }),
      screen.getByRole("button", { name: "Reintentar el historial" }),
      hideControl,
      editorRetry,
    ];
    for (const control of controls) {
      expect(control).toHaveClass("touch-target");
    }
    visible.unmount();

    const hidden = renderEditor({ question: F_Q43 });
    expect(
      screen.getByRole("button", { name: "Volver a mostrar" }),
    ).toHaveClass("touch-target");
    hidden.unmount();
  });

  it("QEDIT-36 a local validation error hides the retry for the previous server failure", async () => {
    const user = userEvent.setup();
    const { onRetry } = renderEditor({
      failure: {
        kind: "error",
        message: "Error del servidor.",
        retryable: true,
      },
    });
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeVisible();

    fireEvent.change(field("Pregunta en inglés"), { target: { value: "" } });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(within(region()).getByRole("alert")).toHaveTextContent(
      "Pregunta en inglés no puede quedar vacía.",
    );
    expect(
      within(region()).queryByRole("button", { name: "Reintentar" }),
    ).not.toBeInTheDocument();

    fireEvent.change(field("Pregunta en inglés"), {
      target: { value: "Capital of Peru?" },
    });
    const retry = within(region()).getByRole("button", {
      name: "Reintentar",
    });
    expect(retry).toBeVisible();
    await user.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("QEDIT-31 window.confirm is never called, no dialog exists and the group does not trap focus", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderEditor({
      edits: null,
      editsFailure: {
        kind: "error",
        message: "Error del servidor.",
        retryable: true,
      },
    });

    await user.click(screen.getByRole("button", { name: "Ocultar pregunta" }));
    expect(
      screen.getByRole("group", { name: "Confirmar ocultar la pregunta 42" }),
    ).toBeVisible();
    const cancel = screen.getByRole("button", { name: "Cancelar" });
    cancel.focus();
    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Reintentar el historial" }),
    );
    await user.click(cancel);
    await user.click(screen.getByRole("button", { name: "Ocultar pregunta" }));
    await user.click(screen.getByRole("button", { name: "Confirmar ocultar" }));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.queryAllByRole("dialog")).toHaveLength(0);
  });

  it("QEDIT-32 the editor never calls fetch", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const first = renderEditor();

    fireEvent.change(field("Opción incorrecta 2 en inglés"), {
      target: { value: "Arequipa" },
    });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(first.onSave).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Ocultar pregunta" }));
    await user.click(screen.getByRole("button", { name: "Confirmar ocultar" }));
    expect(first.onHide).toHaveBeenCalledTimes(1);
    first.unmount();

    const second = renderEditor({
      question: F_Q43,
      edits: null,
      editsFailure: {
        kind: "error",
        message: "Error del servidor.",
        retryable: true,
      },
    });
    await user.click(screen.getByRole("button", { name: "Volver a mostrar" }));
    expect(second.onRestore).toHaveBeenCalledTimes(1);
    await user.click(
      screen.getByRole("button", { name: "Reintentar el historial" }),
    );
    expect(second.onRetryEdits).toHaveBeenCalledTimes(1);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("QEDIT-33 the draft resets from the server's new question object after a save", () => {
    const { rerenderEditor } = renderEditor();

    fireEvent.change(field("Opción incorrecta 2 en inglés"), {
      target: { value: "Oruro" },
    });
    expect(field("Opción incorrecta 2 en inglés").value).toBe("Oruro");

    rerenderEditor({
      question: {
        ...F_Q42,
        question: "Capital of Peru (country)?",
        wrong_2: "Arequipa",
      },
    });

    expect(field("Pregunta en inglés").value).toBe(
      "Capital of Peru (country)?",
    );
    expect(field("Opción incorrecta 2 en inglés").value).toBe("Arequipa");
  });

  it("QEDIT-34 a local error clears on a draft change while a server failure keeps the draft", async () => {
    const user = userEvent.setup();
    const { rerenderEditor } = renderEditor();

    fireEvent.change(field("Pregunta en inglés"), { target: { value: "" } });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Pregunta en inglés no puede quedar vacía.",
    );

    fireEvent.change(field("Opción incorrecta 2 en inglés"), {
      target: { value: "Arequipa" },
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    rerenderEditor({
      failure: {
        kind: "error",
        message: "El cambio no es válido.",
        detail: "las opciones deben ser distintas",
        retryable: false,
      },
    });
    expect(field("Opción incorrecta 2 en inglés").value).toBe("Arequipa");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "El cambio no es válido.",
    );

    fireEvent.change(field("Opción incorrecta 2 en inglés"), {
      target: { value: "Arequip" },
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "El cambio no es válido.",
    );
    expect(field("Opción incorrecta 2 en inglés").value).toBe("Arequip");
  });

  it("QEDIT-35 the editor alert and the history alert can coexist", () => {
    renderEditor({
      failure: {
        kind: "error",
        message: "Error del servidor.",
        retryable: true,
      },
      edits: null,
      editsFailure: {
        kind: "error",
        message: "¿Está corriendo la API?",
        retryable: true,
      },
    });

    const alerts = within(region()).getAllByRole("alert");
    expect(alerts).toHaveLength(2);
    expect(alerts[0]).toHaveTextContent("Error del servidor.");
    expect(
      within(alerts[0]).getByRole("button", { name: "Reintentar" }),
    ).toBeVisible();
    expect(alerts[1]).toHaveTextContent("No se pudo cargar el historial.");
    expect(alerts[1]).toHaveTextContent("¿Está corriendo la API?");
    expect(
      within(alerts[1]).getByRole("button", {
        name: "Reintentar el historial",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Guardar cambios" }),
    ).toBeEnabled();
  });
});
