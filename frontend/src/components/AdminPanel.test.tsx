import { afterEach, describe, expect, it, vi } from "vitest";
import { createRef } from "react";
import type { RefObject } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AdminFailure } from "../api/adminFailures";
import type {
  AdminReport,
  AdminReportStatusFilter,
  ReportStats,
  ReportStatus,
} from "../api/types";
import { AdminPanel } from "./AdminPanel";
import type { AppliedFilters } from "./AdminPanel";

const F_PEN: AdminReport = {
  id: 7,
  question_id: 42,
  reason: "traduccion",
  comment: null,
  lang: "es",
  status: "pendiente",
  created_at: "2026-10-26T12:00:00Z",
  resolved_at: null,
  question: {
    question: "Capital of Peru?",
    answer: "Lima",
    question_es: "¿Capital del Perú?",
    answer_es: "Lima",
    is_translated: true,
    is_active: true,
  },
};

const S_MIX: ReportStats = {
  pendiente: 3,
  resuelto: 1,
  descartado: 0,
  pending_by_reason: { otro: 1, traduccion: 2 },
};

const S_EMPTY: ReportStats = {
  pendiente: 0,
  resuelto: 4,
  descartado: 2,
  pending_by_reason: {},
};

const S_UNKNOWN: ReportStats = {
  pendiente: 6,
  resuelto: 0,
  descartado: 0,
  pending_by_reason: { duplicada: 2, traduccion: 1, zombi: 3 },
};

function page(count: number): AdminReport[] {
  return Array.from({ length: count }, (_, index) => ({
    ...F_PEN,
    id: index + 1,
  }));
}

interface PanelOverrides {
  stats?: ReportStats | null;
  reports?: readonly AdminReport[];
  filters?: AppliedFilters;
  skip?: number;
  listLoading?: boolean;
  busy?: boolean;
  failure?: AdminFailure | null;
  statusMessage?: string | null;
  expandedIds?: ReadonlySet<number>;
}

interface Spies {
  onApplyFilters: (
    status: AdminReportStatusFilter,
    questionId: number | null,
  ) => void;
  onPage: (skip: number) => void;
  onChangeStatus: (reportId: number, status: ReportStatus) => void;
  onRetry: () => void;
  onToggleQuestion: (reportId: number) => void;
  onEditQuestion: (questionId: number) => void;
  onSignOut: () => void;
}

function makeSpies(): Spies {
  return {
    onApplyFilters: vi.fn(),
    onPage: vi.fn(),
    onChangeStatus: vi.fn(),
    onRetry: vi.fn(),
    onToggleQuestion: vi.fn(),
    onEditQuestion: vi.fn(),
    onSignOut: vi.fn(),
  };
}

function buildProps(
  overrides: PanelOverrides,
  spies: Spies,
  headingRef: RefObject<HTMLHeadingElement | null>,
) {
  return {
    stats: overrides.stats === undefined ? S_MIX : overrides.stats,
    reports: overrides.reports ?? [],
    filters: overrides.filters ?? {
      status: "pendiente" as const,
      questionId: null,
    },
    skip: overrides.skip ?? 0,
    listLoading: overrides.listLoading ?? false,
    busy: overrides.busy ?? false,
    failure: overrides.failure ?? null,
    statusMessage: overrides.statusMessage ?? null,
    expandedIds: overrides.expandedIds ?? new Set<number>(),
    headingRef,
    ...spies,
  };
}

function renderPanel(overrides: PanelOverrides = {}) {
  const spies = makeSpies();
  const headingRef = createRef<HTMLHeadingElement>();
  const view = render(
    <AdminPanel {...buildProps(overrides, spies, headingRef)} />,
  );
  const rerenderPanel = (next: PanelOverrides) => {
    view.rerender(
      <AdminPanel
        {...buildProps({ ...overrides, ...next }, spies, headingRef)}
      />,
    );
  };
  return { ...view, ...spies, rerenderPanel };
}

describe("AdminPanel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("LIST-01 renders the filter labels, option order, default and the id hint", () => {
    const { rerenderPanel } = renderPanel();

    const select = screen.getByLabelText("Estado");
    expect(select.tagName).toBe("SELECT");
    expect(
      within(select)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Pendientes", "Resueltos", "Descartados", "Todos"]);
    expect((select as HTMLSelectElement).value).toBe("pendiente");

    const idInput = screen.getByLabelText("Id de la pregunta");
    expect((idInput as HTMLInputElement).value).toBe("");
    expect(idInput).toHaveAttribute("inputMode", "numeric");
    const hintId = idInput.getAttribute("aria-describedby");
    expect(document.getElementById(String(hintId))).toHaveTextContent(
      "Opcional. Solo números enteros.",
    );

    const apply = screen.getByRole("button", { name: "Aplicar filtros" });
    expect(apply).toHaveAttribute("type", "submit");
    expect(
      screen.getByRole("form", { name: "Filtros de reportes" }),
    ).toContainElement(apply);

    rerenderPanel({ filters: { status: "descartado", questionId: null } });
    expect((screen.getByLabelText("Estado") as HTMLSelectElement).value).toBe(
      "descartado",
    );
  });

  it("LIST-02 an invalid id shows the exact message and applies nothing", async () => {
    const user = userEvent.setup();
    const { onApplyFilters } = renderPanel();
    const input = screen.getByLabelText("Id de la pregunta");

    for (const value of ["abc", "0", "-1", "1.5"]) {
      await user.clear(input);
      await user.type(input, value);
      await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));

      expect(screen.getByRole("alert")).toHaveTextContent(
        "El id de la pregunta tiene que ser un número entero mayor que 0.",
      );
      expect((input as HTMLInputElement).value).toBe(value);
    }
    expect(onApplyFilters).not.toHaveBeenCalled();
  });

  it("LIST-03 a valid id and status apply once with the number", async () => {
    const user = userEvent.setup();
    const { onApplyFilters } = renderPanel();

    await user.selectOptions(screen.getByLabelText("Estado"), "descartado");
    await user.type(screen.getByLabelText("Id de la pregunta"), "42");
    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    expect(onApplyFilters).toHaveBeenCalledTimes(1);
    expect(onApplyFilters).toHaveBeenCalledWith("descartado", 42);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("LIST-04 an empty or spaces-only id applies null", async () => {
    const user = userEvent.setup();
    const first = renderPanel({
      filters: { status: "pendiente", questionId: 42 },
    });
    const input = screen.getByLabelText("Id de la pregunta");
    expect((input as HTMLInputElement).value).toBe("42");
    await user.clear(input);
    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    expect(first.onApplyFilters).toHaveBeenCalledWith("pendiente", null);
    first.unmount();

    const second = renderPanel({
      filters: { status: "pendiente", questionId: 42 },
    });
    const secondInput = screen.getByLabelText("Id de la pregunta");
    await user.clear(secondInput);
    await user.type(secondInput, "   ");
    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    expect(second.onApplyFilters).toHaveBeenCalledWith("pendiente", null);
  });

  it("LIST-05 the pager follows the 20-item rule and shows Página N", async () => {
    const user = userEvent.setup();
    const { onPage, rerenderPanel } = renderPanel({
      skip: 0,
      reports: page(20),
    });

    const previous = screen.getByRole("button", { name: "Anterior" });
    const next = screen.getByRole("button", { name: "Siguiente" });
    expect(previous).toBeDisabled();
    expect(next).toBeEnabled();
    expect(screen.getByText("Página 1")).toBeVisible();

    await user.click(next);
    expect(onPage).toHaveBeenCalledTimes(1);
    expect(onPage).toHaveBeenCalledWith(20);

    rerenderPanel({ skip: 20, reports: page(19) });
    expect(screen.getByText("Página 2")).toBeVisible();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();

    rerenderPanel({ skip: 20, reports: page(20) });
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeEnabled();
  });

  it("LIST-06 both pager buttons are disabled while busy", async () => {
    const user = userEvent.setup();
    const { onPage, rerenderPanel } = renderPanel({
      skip: 20,
      reports: page(20),
      busy: true,
    });

    const previous = screen.getByRole("button", { name: "Anterior" });
    const next = screen.getByRole("button", { name: "Siguiente" });
    expect(previous).toBeDisabled();
    expect(next).toBeDisabled();
    fireEvent.click(previous);
    fireEvent.click(next);
    expect(onPage).not.toHaveBeenCalled();

    rerenderPanel({ busy: false });
    await user.click(screen.getByRole("button", { name: "Anterior" }));
    expect(onPage).toHaveBeenCalledTimes(1);
    expect(onPage).toHaveBeenCalledWith(0);
  });

  it("LIST-07 loading, empty and row states use the exact copy and role", () => {
    const { rerenderPanel } = renderPanel({ listLoading: true, reports: [] });

    expect(
      screen.getByRole("heading", { name: "Lista de reportes" }),
    ).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Cargando reportes...",
    );

    rerenderPanel({ listLoading: false, reports: [] });
    expect(screen.getByRole("status")).toHaveTextContent(
      "No hay reportes para mostrar.",
    );
    expect(screen.queryByText("Cargando reportes...")).not.toBeInTheDocument();

    rerenderPanel({ reports: [F_PEN] });
    expect(screen.getByText("Reporte 7")).toBeVisible();
    expect(screen.queryByText("Cargando reportes...")).not.toBeInTheDocument();
    expect(
      screen.queryByText("No hay reportes para mostrar."),
    ).not.toBeInTheDocument();
  });

  it("STATS-01 renders the counters and only the present reasons in the fixed order", () => {
    const { rerenderPanel } = renderPanel({ stats: S_MIX });

    const counters = within(
      screen.getByRole("list", { name: "Contadores de reportes" }),
    ).getAllByRole("listitem");
    expect(counters.map((item) => item.textContent)).toEqual([
      "Pendientes: 3",
      "Resueltos: 1",
      "Descartados: 0",
    ]);
    const breakdown = within(
      screen.getByRole("list", { name: "Pendientes por motivo" }),
    ).getAllByRole("listitem");
    expect(breakdown.map((item) => item.textContent)).toEqual([
      "Traducción: 2",
      "Otro: 1",
    ]);
    expect(
      screen.queryByText("Respuesta incorrecta: 0"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Error en el texto: 0")).not.toBeInTheDocument();

    rerenderPanel({
      stats: { ...S_MIX, pending_by_reason: { traduccion: 0 } },
    });
    expect(screen.getByText("Traducción: 0")).toBeVisible();
    expect(screen.queryByText("Otro: 0")).not.toBeInTheDocument();
  });

  it("STATS-02 an empty breakdown has its own copy", () => {
    renderPanel({ stats: S_EMPTY });

    const counters = within(
      screen.getByRole("list", { name: "Contadores de reportes" }),
    ).getAllByRole("listitem");
    expect(counters.map((item) => item.textContent)).toEqual([
      "Pendientes: 0",
      "Resueltos: 4",
      "Descartados: 2",
    ]);
    expect(screen.getByText("Sin pendientes por motivo.")).toBeVisible();
    expect(
      screen.queryByRole("list", { name: "Pendientes por motivo" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/^Traducción:/)).not.toBeInTheDocument();
  });

  it("STATS-04 an unknown reason renders last with its raw key and no alert", () => {
    renderPanel({ stats: S_UNKNOWN });

    expect(screen.getByText("Pendientes: 6")).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    const breakdown = within(
      screen.getByRole("list", { name: "Pendientes por motivo" }),
    ).getAllByRole("listitem");
    expect(breakdown.map((item) => item.textContent)).toEqual([
      "Traducción: 1",
      "duplicada: 2",
      "zombi: 3",
    ]);
    expect(
      screen.queryByText(/^Respuesta incorrecta:/),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/^Error en el texto:/)).not.toBeInTheDocument();
  });

  it("F2 opening and closing the question never calls fetch", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const closed = renderPanel({ reports: [F_PEN] });
    await user.click(
      screen.getByRole("button", { name: "Abrir la pregunta 42" }),
    );
    expect(closed.onToggleQuestion).toHaveBeenCalledWith(7);
    expect(fetchSpy).not.toHaveBeenCalled();
    closed.unmount();

    const open = renderPanel({
      reports: [F_PEN],
      expandedIds: new Set([7]),
    });
    expect(screen.getByRole("region", { name: "Pregunta 42" })).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Cerrar la pregunta 42" }),
    );
    expect(open.onToggleQuestion).toHaveBeenCalledWith(7);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("A11Y-02 every panel control carries touch-target", () => {
    renderPanel({
      reports: [F_PEN],
      expandedIds: new Set([7]),
    });

    const controls = [
      screen.getByRole("button", { name: "Salir" }),
      screen.getByLabelText("Estado"),
      screen.getByLabelText("Id de la pregunta"),
      screen.getByRole("button", { name: "Aplicar filtros" }),
      screen.getByRole("button", { name: "Anterior" }),
      screen.getByRole("button", { name: "Siguiente" }),
      screen.getByRole("button", { name: "Cerrar la pregunta 42" }),
      screen.getByRole("button", { name: "Marcar resuelto el reporte 7" }),
      screen.getByRole("button", { name: "Descartar el reporte 7" }),
    ];
    for (const control of controls) {
      expect(control).toHaveClass("touch-target");
    }
  });

  it("A11Y-03 Salir is exposed and calls back once", async () => {
    const user = userEvent.setup();
    const { onSignOut } = renderPanel();

    await user.click(screen.getByRole("button", { name: "Salir" }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it("routes a row click to the status and toggle callbacks", async () => {
    const user = userEvent.setup();
    const { onChangeStatus, onToggleQuestion } = renderPanel({
      reports: [F_PEN],
    });

    await user.click(
      screen.getByRole("button", { name: "Marcar resuelto el reporte 7" }),
    );
    expect(onChangeStatus).toHaveBeenCalledWith(7, "resuelto");

    await user.click(
      screen.getByRole("button", { name: "Abrir la pregunta 42" }),
    );
    expect(onToggleQuestion).toHaveBeenCalledWith(7);
  });

  it("ERR-20 the panel renders the failure message, the detail only when present and Reintentar only when retryable", async () => {
    const user = userEvent.setup();
    const first = renderPanel({
      failure: {
        kind: "error",
        message: "Error del servidor.",
        retryable: true,
      },
    });
    const alert = screen.getByRole("alert");
    expect(within(alert).getByText("Error del servidor.")).toBeVisible();
    expect(alert.querySelectorAll("p")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(first.onRetry).toHaveBeenCalledTimes(1);
    first.unmount();

    const second = renderPanel({
      failure: {
        kind: "error",
        message: "El cambio de estado no es válido.",
        detail: "estado inválido",
        retryable: false,
      },
    });
    const detailed = screen.getByRole("alert");
    expect(
      within(detailed).getByText("El cambio de estado no es válido."),
    ).toBeVisible();
    expect(within(detailed).getByText("estado inválido")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Reintentar" }),
    ).not.toBeInTheDocument();
    second.unmount();

    renderPanel({ failure: null, statusMessage: "Estado actualizado." });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("Estado actualizado.")).toHaveAttribute(
      "role",
      "status",
    );
  });

  it("QPANEL-01 the Pregunta form exposes the label, hint and Abrir editor button", () => {
    renderPanel();

    const form = screen.getByRole("form", { name: "Abrir editor de pregunta" });
    expect(form).toBeVisible();
    const input = within(form).getByLabelText("Pregunta");
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveAttribute("inputMode", "numeric");
    expect((input as HTMLInputElement).value).toBe("");
    const hintId = input.getAttribute("aria-describedby");
    expect(document.getElementById(String(hintId))).toHaveTextContent(
      "Número de pregunta. Solo números enteros.",
    );
    expect(
      within(form).getByRole("button", { name: "Abrir editor" }),
    ).toHaveAttribute("type", "submit");

    const filters = screen.getByRole("form", { name: "Filtros de reportes" });
    const listHeading = screen.getByRole("heading", {
      name: "Lista de reportes",
    });
    expect(
      filters.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      form.compareDocumentPosition(listHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("QPANEL-02 an invalid question number keeps the draft, shows the exact alert and fires no callback", async () => {
    const user = userEvent.setup();
    const { onEditQuestion } = renderPanel();
    const input = screen.getByLabelText("Pregunta");

    for (const value of ["abc", "0", "-1", "1.5"]) {
      await user.clear(input);
      await user.type(input, value);
      await user.click(screen.getByRole("button", { name: "Abrir editor" }));

      expect(screen.getByRole("alert")).toHaveTextContent(
        "El id de la pregunta tiene que ser un número entero mayor que 0.",
      );
      expect((input as HTMLInputElement).value).toBe(value);
    }
    expect(onEditQuestion).not.toHaveBeenCalled();
  });

  it("QPANEL-03 a valid number calls onEditQuestion once with 42", async () => {
    const user = userEvent.setup();
    const { onEditQuestion } = renderPanel();

    await user.type(screen.getByLabelText("Pregunta"), "42");
    await user.click(screen.getByRole("button", { name: "Abrir editor" }));

    expect(onEditQuestion).toHaveBeenCalledTimes(1);
    expect(onEditQuestion).toHaveBeenCalledWith(42);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect((screen.getByLabelText("Pregunta") as HTMLInputElement).value).toBe(
      "42",
    );
  });

  it("QPANEL-04 the report filter is unchanged by the open-editor form", async () => {
    const user = userEvent.setup();
    const { onApplyFilters, onEditQuestion } = renderPanel();

    await user.type(screen.getByLabelText("Id de la pregunta"), "42");
    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    expect(onApplyFilters).toHaveBeenCalledTimes(1);
    expect(onApplyFilters).toHaveBeenCalledWith("pendiente", 42);

    const editorInput = screen.getByLabelText("Pregunta");
    await user.type(editorInput, "99");
    await user.clear(editorInput);
    expect(onApplyFilters).toHaveBeenCalledTimes(1);
    expect(onEditQuestion).not.toHaveBeenCalled();

    await user.type(editorInput, "43");
    await user.click(screen.getByRole("button", { name: "Abrir editor" }));
    expect(onEditQuestion).toHaveBeenCalledTimes(1);
    expect(onEditQuestion).toHaveBeenCalledWith(43);
    expect(onApplyFilters).toHaveBeenCalledTimes(1);
  });

  it("QPANEL-05 every new control carries touch-target", () => {
    renderPanel();

    expect(screen.getByLabelText("Pregunta")).toHaveClass("touch-target");
    expect(screen.getByRole("button", { name: "Abrir editor" })).toHaveClass(
      "touch-target",
    );
  });

  it("QPANEL-06 Abrir editor is disabled while busy", async () => {
    const user = userEvent.setup();
    const { onEditQuestion, rerenderPanel } = renderPanel({ busy: true });

    const disabled = screen.getByRole("button", { name: "Abrir editor" });
    expect(disabled).toBeDisabled();
    await user.type(screen.getByLabelText("Pregunta"), "42");
    await user.click(disabled);
    expect(onEditQuestion).not.toHaveBeenCalled();

    rerenderPanel({ busy: false });
    expect(screen.getByRole("button", { name: "Abrir editor" })).toBeEnabled();
  });
});
