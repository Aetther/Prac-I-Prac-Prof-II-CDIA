import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import userEvent from "@testing-library/user-event";
import type { AdminReport } from "../api/types";
import { AdminReportRow } from "./AdminReportRow";

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

const F_RES: AdminReport = {
  id: 8,
  question_id: 43,
  reason: "respuesta_incorrecta",
  comment: "Falta la tilde",
  lang: "es",
  status: "resuelto",
  created_at: "2026-10-26T13:00:00Z",
  resolved_at: "2026-10-27T09:30:00Z",
  question: {
    question: "Capital of Chile?",
    answer: "Santiago",
    question_es: "¿Capital de Chile?",
    answer_es: "Santiago",
    is_translated: true,
    is_active: true,
  },
};

const F_DES: AdminReport = {
  id: 9,
  question_id: 44,
  reason: "otro",
  comment: "",
  lang: "en",
  status: "descartado",
  created_at: "2026-10-26T14:00:00Z",
  resolved_at: "2026-10-27T10:00:00Z",
  question: {
    question: "Capital of Ecuador?",
    answer: "Quito",
    question_es: null,
    answer_es: null,
    is_translated: false,
    is_active: true,
  },
};

const F_NULL: AdminReport = {
  id: 10,
  question_id: 45,
  reason: "error_texto",
  comment: null,
  lang: "es",
  status: "pendiente",
  created_at: "2026-10-26T15:00:00Z",
  resolved_at: null,
  question: {
    question: "Capital of Bolivia?",
    answer: "La Paz",
    question_es: null,
    answer_es: null,
    is_translated: false,
    is_active: false,
  },
};

const F_EMPTY: AdminReport = {
  ...F_NULL,
  id: 12,
  question: {
    ...F_NULL.question,
    question_es: "",
    answer_es: "",
  },
};

const F_HTML: AdminReport = {
  ...F_PEN,
  id: 11,
  comment: "<b>Falta</b> la tilde",
  question: {
    ...F_PEN.question,
    question: "<b>Capital</b> of Peru?",
  },
};

interface RowOptions {
  expanded?: boolean;
  busy?: boolean;
  report?: AdminReport;
}

function renderRow({
  expanded = false,
  busy = false,
  report = F_PEN,
}: RowOptions = {}) {
  const onToggleQuestion = vi.fn();
  const onChangeStatus = vi.fn();
  const onEditQuestion = vi.fn();
  const view = render(
    <ul>
      <AdminReportRow
        report={report}
        expanded={expanded}
        busy={busy}
        onToggleQuestion={onToggleQuestion}
        onChangeStatus={onChangeStatus}
        onEditQuestion={onEditQuestion}
      />
    </ul>,
  );
  return { ...view, onToggleQuestion, onChangeStatus, onEditQuestion };
}

function renderRows(rows: readonly ReactElement[]) {
  return render(<ul>{rows}</ul>);
}

function textAfter(heading: HTMLElement): string | null {
  return heading.nextElementSibling?.textContent ?? null;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AdminReportRow", () => {
  it("QVIEW-01 a pending row shows its meta, the formatted time and no resolution line", () => {
    renderRow();

    expect(screen.getByText("Reporte 7")).toBeVisible();
    expect(screen.getByText("Pregunta: 42")).toBeVisible();
    expect(screen.getByText("Motivo: Traducción")).toBeVisible();
    expect(screen.getByText("Idioma: Español")).toBeVisible();
    expect(screen.getByText("Estado: Pendiente")).toBeVisible();
    expect(screen.getByText("Comentario: Sin comentario.")).toBeVisible();

    const created = document.querySelector("time");
    expect(created).toHaveAttribute("dateTime", "2026-10-26T12:00:00Z");
    expect(created).toHaveTextContent("26/10/26, 9:00 a. m.");
    expect(screen.queryByText(/^Resuelto:/)).not.toBeInTheDocument();

    const toggle = screen.getByRole("button", {
      name: "Abrir la pregunta 42",
    });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("region", { name: "Pregunta 42" }),
    ).not.toBeInTheDocument();
  });

  it("QVIEW-02 a comment and a resolution timestamp are shown when present", () => {
    renderRow({ report: F_RES });

    expect(screen.getByText("Comentario: Falta la tilde")).toBeVisible();
    expect(
      screen.queryByText("Comentario: Sin comentario."),
    ).not.toBeInTheDocument();

    const resolved = screen.getByText("27/10/26, 6:30 a. m.");
    expect(resolved.tagName).toBe("TIME");
    expect(resolved).toHaveAttribute("dateTime", "2026-10-27T09:30:00Z");
    expect(screen.getByText(/^Resuelto:/)).toBeVisible();
  });

  it("QVIEW-03 an HTML comment stays literal text", () => {
    const { container } = renderRow({ report: F_HTML });

    expect(screen.getByText("Comentario: <b>Falta</b> la tilde")).toBeVisible();
    expect(container.querySelector("b")).toBeNull();
  });

  it("QVIEW-04 the toggle is collapsed, names the question and calls back once", async () => {
    const user = userEvent.setup();
    const { onToggleQuestion } = renderRow();

    const toggle = screen.getByRole("button", {
      name: "Abrir la pregunta 42",
    });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("region", { name: "Pregunta 42" }),
    ).not.toBeInTheDocument();

    await user.click(toggle);
    expect(onToggleQuestion).toHaveBeenCalledTimes(1);
    expect(onToggleQuestion).toHaveBeenCalledWith(7);
  });

  it("QVIEW-05 the open region shows both languages in order without Oculta", () => {
    renderRow({ expanded: true, report: F_PEN });

    const toggle = screen.getByRole("button", {
      name: "Cerrar la pregunta 42",
    });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const region = screen.getByRole("region", { name: "Pregunta 42" });
    expect(toggle).toHaveAttribute("aria-controls", region.id);

    const headings = within(region).getAllByRole("heading");
    expect(headings.map((heading) => heading.textContent)).toEqual([
      "Pregunta en inglés",
      "Respuesta en inglés",
      "Pregunta en español",
      "Respuesta en español",
    ]);
    expect(headings.map(textAfter)).toEqual([
      "Capital of Peru?",
      "Lima",
      "¿Capital del Perú?",
      "Lima",
    ]);
    expect(within(region).getByText("Traducida")).toBeVisible();
    expect(within(region).queryByText("Oculta")).not.toBeInTheDocument();
  });

  it("QVIEW-06 null Spanish fields and a hidden question are labelled", () => {
    renderRow({ expanded: true, report: F_NULL });

    const region = screen.getByRole("region", { name: "Pregunta 45" });
    const headings = within(region).getAllByRole("heading");
    expect(textAfter(headings[2])).toBe("Sin traducir");
    expect(textAfter(headings[3])).toBe("Sin traducir");
    expect(region.querySelector("p")).toHaveTextContent("Sin traducir");
    expect(within(region).getByText("Oculta")).toBeVisible();
    expect(within(region).getByText("Capital of Bolivia?")).toBeVisible();
    expect(within(region).getByText("La Paz")).toBeVisible();
    expect(within(region).queryByText("Traducida")).not.toBeInTheDocument();
  });

  it("QVIEW-07 two rows can be open at once", () => {
    const { rerender } = renderRows([
      <AdminReportRow
        key="7"
        report={F_PEN}
        expanded
        busy={false}
        onToggleQuestion={vi.fn()}
        onChangeStatus={vi.fn()}
        onEditQuestion={vi.fn()}
      />,
      <AdminReportRow
        key="8"
        report={F_RES}
        expanded
        busy={false}
        onToggleQuestion={vi.fn()}
        onChangeStatus={vi.fn()}
        onEditQuestion={vi.fn()}
      />,
    ]);

    expect(screen.getByRole("region", { name: "Pregunta 42" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Pregunta 43" })).toBeVisible();

    rerender(
      <ul>
        <AdminReportRow
          report={F_PEN}
          expanded={false}
          busy={false}
          onToggleQuestion={vi.fn()}
          onChangeStatus={vi.fn()}
          onEditQuestion={vi.fn()}
        />
        <AdminReportRow
          report={F_RES}
          expanded
          busy={false}
          onToggleQuestion={vi.fn()}
          onChangeStatus={vi.fn()}
          onEditQuestion={vi.fn()}
        />
      </ul>,
    );

    expect(
      screen.queryByRole("region", { name: "Pregunta 42" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Pregunta 43" })).toBeVisible();
  });

  it("QVIEW-08 an HTML question stays literal text", () => {
    const { container } = renderRow({ expanded: true, report: F_HTML });

    const region = screen.getByRole("region", { name: "Pregunta 42" });
    expect(within(region).getByText("<b>Capital</b> of Peru?")).toBeVisible();
    expect(container.querySelector("b")).toBeNull();
  });

  it("QVIEW-09 empty-string Spanish fields show Sin traducir, not a blank block", () => {
    renderRow({ expanded: true, report: F_EMPTY });

    const region = screen.getByRole("region", { name: "Pregunta 45" });
    const headings = within(region).getAllByRole("heading");
    expect(textAfter(headings[2])).toBe("Sin traducir");
    expect(textAfter(headings[3])).toBe("Sin traducir");
    expect(textAfter(headings[2])).not.toBe("");
    expect(textAfter(headings[3])).not.toBe("");
    expect(within(region).getByText("Capital of Bolivia?")).toBeVisible();
    expect(within(region).getByText("La Paz")).toBeVisible();
    expect(within(region).getByText("Oculta")).toBeVisible();
  });

  it("PATCH-01 each status offers exactly its two actions and calls the right target", async () => {
    const user = userEvent.setup();
    const pending = renderRow();
    expect(
      screen.getByRole("button", { name: "Marcar resuelto el reporte 7" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Descartar el reporte 7" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Volver a pendiente el reporte 7" }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Marcar resuelto el reporte 7" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Descartar el reporte 7" }),
    );
    expect(pending.onChangeStatus).toHaveBeenNthCalledWith(1, 7, "resuelto");
    expect(pending.onChangeStatus).toHaveBeenNthCalledWith(2, 7, "descartado");
    pending.unmount();

    const resolved = renderRow({ report: F_RES });
    expect(
      screen.getByRole("button", { name: "Volver a pendiente el reporte 8" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Descartar el reporte 8" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Marcar resuelto el reporte 8" }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Volver a pendiente el reporte 8" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Descartar el reporte 8" }),
    );
    expect(resolved.onChangeStatus).toHaveBeenNthCalledWith(1, 8, "pendiente");
    expect(resolved.onChangeStatus).toHaveBeenNthCalledWith(2, 8, "descartado");
    resolved.unmount();

    renderRow({ report: F_DES });
    expect(
      screen.getByRole("button", { name: "Volver a pendiente el reporte 9" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Marcar resuelto el reporte 9" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Descartar el reporte 9" }),
    ).not.toBeInTheDocument();
  });

  it("PATCH-02 every status button is disabled while busy and enabled otherwise", async () => {
    const user = userEvent.setup();
    const { onChangeStatus, rerender } = renderRow({
      report: F_PEN,
      busy: true,
    });

    const resolved = screen.getByRole("button", {
      name: "Marcar resuelto el reporte 7",
    });
    const discard = screen.getByRole("button", {
      name: "Descartar el reporte 7",
    });
    expect(resolved).toBeDisabled();
    expect(discard).toBeDisabled();
    fireEvent.click(resolved);
    fireEvent.click(discard);
    expect(onChangeStatus).not.toHaveBeenCalled();

    rerender(
      <ul>
        <AdminReportRow
          report={F_PEN}
          expanded={false}
          busy={false}
          onToggleQuestion={vi.fn()}
          onChangeStatus={onChangeStatus}
          onEditQuestion={vi.fn()}
        />
      </ul>,
    );
    const enabled = screen.getByRole("button", {
      name: "Marcar resuelto el reporte 7",
    });
    expect(enabled).toBeEnabled();
    await user.click(enabled);
    expect(onChangeStatus).toHaveBeenCalledTimes(1);
  });

  it("F2 opening and closing the question never calls fetch", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { onToggleQuestion, onChangeStatus, rerender } = renderRow({
      expanded: false,
    });

    await user.click(
      screen.getByRole("button", { name: "Abrir la pregunta 42" }),
    );
    expect(onToggleQuestion).toHaveBeenCalledWith(7);
    expect(fetchSpy).not.toHaveBeenCalled();

    rerender(
      <ul>
        <AdminReportRow
          report={F_PEN}
          expanded
          busy={false}
          onToggleQuestion={onToggleQuestion}
          onChangeStatus={onChangeStatus}
          onEditQuestion={vi.fn()}
        />
      </ul>,
    );
    expect(screen.getByRole("region", { name: "Pregunta 42" })).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Cerrar la pregunta 42" }),
    );
    expect(onToggleQuestion).toHaveBeenCalledTimes(2);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("A11Y-01 every row control carries touch-target", () => {
    renderRow({ expanded: true, report: F_PEN });

    for (const name of [
      "Marcar resuelto el reporte 7",
      "Descartar el reporte 7",
      "Cerrar la pregunta 42",
    ]) {
      expect(screen.getByRole("button", { name })).toHaveClass("touch-target");
    }
  });

  it("QROW-01 the open region offers the editor entry point with its aria-label and touch-target", () => {
    renderRow({ expanded: true, report: F_PEN });

    const region = screen.getByRole("region", { name: "Pregunta 42" });
    const button = within(region).getByRole("button", {
      name: "Editar pregunta 42",
    });
    expect(button).toHaveTextContent("Editar pregunta");
    expect(button).toHaveClass("touch-target");
    expect(within(region).getByText("Capital of Peru?")).toBeVisible();
    expect(within(region).getByText("Traducida")).toBeVisible();
    expect(within(region).getByText("¿Capital del Perú?")).toBeVisible();
  });

  it("QROW-02 clicking the editor entry point calls onEditQuestion once with the question id", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { onEditQuestion, onToggleQuestion } = renderRow({
      expanded: true,
      report: F_PEN,
    });

    await user.click(
      screen.getByRole("button", { name: "Editar pregunta 42" }),
    );

    expect(onEditQuestion).toHaveBeenCalledTimes(1);
    expect(onEditQuestion).toHaveBeenCalledWith(42);
    expect(onToggleQuestion).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("QROW-03 a closed region renders no Editar pregunta button and makes no request", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { onToggleQuestion } = renderRow({ expanded: false });

    expect(
      screen.queryByRole("button", { name: "Editar pregunta 42" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Pregunta 42" }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Abrir la pregunta 42" }),
    );
    expect(onToggleQuestion).toHaveBeenCalledWith(7);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("QROW-04 the entry button is disabled while the panel is busy", async () => {
    const user = userEvent.setup();
    const busyView = renderRow({ expanded: true, report: F_PEN, busy: true });

    const disabled = screen.getByRole("button", {
      name: "Editar pregunta 42",
    });
    expect(disabled).toBeDisabled();
    await user.click(disabled);
    expect(busyView.onEditQuestion).not.toHaveBeenCalled();
    busyView.unmount();

    const { onEditQuestion } = renderRow({ expanded: true, report: F_PEN });
    const enabled = screen.getByRole("button", { name: "Editar pregunta 42" });
    expect(enabled).toBeEnabled();
    await user.click(enabled);
    expect(onEditQuestion).toHaveBeenCalledTimes(1);
  });
});
