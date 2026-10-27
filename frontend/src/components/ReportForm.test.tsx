import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReportReason } from "../api/types";
import type { ReportFailure, ReportSubmissionResult } from "../game/reporting";
import { ReportForm } from "./ReportForm";

interface Props {
  disabled?: boolean;
  unavailable?: boolean;
  onCancel?: () => void;
  onSuccess?: () => void;
  onSubmit?: (
    reason: ReportReason,
    comment: string,
  ) => Promise<ReportSubmissionResult>;
}

function renderForm({
  disabled = false,
  unavailable = false,
  onCancel = vi.fn(),
  onSuccess = vi.fn(),
  onSubmit = vi.fn().mockResolvedValue({ ok: true }),
}: Props = {}) {
  const view = render(
    <ReportForm
      disabled={disabled}
      unavailable={unavailable}
      onCancel={onCancel}
      onSuccess={onSuccess}
      onSubmit={onSubmit}
    />,
  );
  return { ...view, onCancel, onSuccess, onSubmit };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function failure(overrides: Partial<ReportFailure> = {}): ReportFailure {
  return {
    ok: false,
    message: "¿Está corriendo la API?",
    retryable: false,
    unavailable: false,
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ReportForm", () => {
  it("RFM-01 renders the named region, group, four unselected radios in order and no dialog", async () => {
    renderForm();

    expect(
      screen.getByRole("region", { name: "Reportar pregunta" }),
    ).toBeVisible();
    expect(
      screen.getByRole("group", { name: "Motivo del reporte" }),
    ).toBeVisible();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(4);
    expect(radios.map((radio) => radio.getAttribute("value"))).toEqual([
      "traduccion",
      "respuesta_incorrecta",
      "error_texto",
      "otro",
    ]);
    expect(radios.map((radio) => (radio as HTMLInputElement).checked)).toEqual([
      false,
      false,
      false,
      false,
    ]);
    for (const label of [
      "Traducción",
      "Respuesta incorrecta",
      "Error en el texto",
      "Otro",
    ]) {
      expect(screen.getByLabelText(label)).toBeVisible();
    }
    expect(screen.queryAllByRole("dialog")).toHaveLength(0);
  });

  it("RFM-02 starts empty with 0/500 and a disabled Enviar reporte", () => {
    renderForm();

    const textarea = screen.getByLabelText("Comentario");
    expect(textarea.tagName).toBe("TEXTAREA");
    expect((textarea as HTMLTextAreaElement).value).toBe("");
    const counter = screen.getByText("0/500");
    expect(counter).toHaveAttribute("aria-live", "polite");
    expect(
      screen.getByRole("button", { name: "Enviar reporte" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeVisible();
    expect(screen.getByText("Opcional; obligatorio para Otro.")).toBeVisible();
  });

  it("RFM-03 choosing a reason checks it and enables submit", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByLabelText("Traducción"));

    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    expect(radios.map((radio) => radio.checked)).toEqual([
      true,
      false,
      false,
      false,
    ]);
    expect(
      screen.getByRole("button", { name: "Enviar reporte" }),
    ).toBeEnabled();
  });

  it("RFM-04 otro with no comment is blocked and sends nothing", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.click(screen.getByLabelText("Otro"));

    expect(
      screen.getByText("Escribí un comentario para el motivo Otro."),
    ).toBeVisible();
    const submit = screen.getByRole("button", { name: "Enviar reporte" });
    expect(submit).toBeDisabled();
    await user.click(submit);
    expect(onSubmit).not.toHaveBeenCalled();
    expect((screen.getByLabelText("Otro") as HTMLInputElement).checked).toBe(
      true,
    );
    expect(
      (screen.getByLabelText("Comentario") as HTMLTextAreaElement).value,
    ).toBe("");
  });

  it("RFM-05 otro with only spaces is invalid and one character fixes it", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByLabelText("Otro"));

    fireEvent.change(screen.getByLabelText("Comentario"), {
      target: { value: "   " },
    });
    expect(
      screen.getByText("Escribí un comentario para el motivo Otro."),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Enviar reporte" }),
    ).toBeDisabled();

    await user.type(screen.getByLabelText("Comentario"), "x");
    expect(
      screen.queryByText("Escribí un comentario para el motivo Otro."),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Enviar reporte" }),
    ).toBeEnabled();
  });

  it("RFM-06 501 characters show 501/500, data-over-limit and block submit", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await user.click(screen.getByLabelText("Traducción"));

    fireEvent.change(screen.getByLabelText("Comentario"), {
      target: { value: "a".repeat(501) },
    });

    const counter = screen.getByText("501/500");
    expect(counter).toHaveAttribute("data-over-limit", "true");
    expect(
      screen.getByText("El comentario no puede superar los 500 caracteres."),
    ).toBeVisible();
    const submit = screen.getByRole("button", { name: "Enviar reporte" });
    expect(submit).toBeDisabled();
    await user.click(submit);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("RFM-07 500 characters are accepted and clear the over-limit state", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByLabelText("Traducción"));

    fireEvent.change(screen.getByLabelText("Comentario"), {
      target: { value: "a".repeat(500) },
    });

    const counter = screen.getByText("500/500");
    expect(counter).not.toHaveAttribute("data-over-limit");
    expect(
      screen.queryByText("El comentario no puede superar los 500 caracteres."),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Enviar reporte" }),
    ).toBeEnabled();
  });

  it("RFM-08 counts the raw value including edge spaces", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByLabelText("Otro"));

    fireEvent.change(screen.getByLabelText("Comentario"), {
      target: { value: "  Falta la tilde  " },
    });

    expect(screen.getByText("18/500")).toBeVisible();
  });

  it.each(["traduccion", "respuesta_incorrecta", "error_texto"] as const)(
    "RFM-09 %s accepts an empty and a whitespace-only comment",
    async (reason) => {
      const user = userEvent.setup();
      const onSubmit = vi.fn().mockResolvedValue({ ok: true });
      const { unmount } = renderForm({ onSubmit });
      const label =
        reason === "traduccion"
          ? "Traducción"
          : reason === "respuesta_incorrecta"
            ? "Respuesta incorrecta"
            : "Error en el texto";

      await user.click(screen.getByLabelText(label));
      await user.click(screen.getByRole("button", { name: "Enviar reporte" }));
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(onSubmit).toHaveBeenLastCalledWith(reason, "");

      fireEvent.change(screen.getByLabelText("Comentario"), {
        target: { value: "   " },
      });
      await user.click(screen.getByRole("button", { name: "Enviar reporte" }));
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
      expect(onSubmit).toHaveBeenLastCalledWith(reason, "   ");
      unmount();
    },
  );

  it("RFM-10 submits the selected reason and raw comment once and reports success", async () => {
    const user = userEvent.setup();
    const { onSubmit, onSuccess } = renderForm();
    await user.click(screen.getByLabelText("Traducción"));
    await user.type(screen.getByLabelText("Comentario"), "  texto  ");

    await user.click(screen.getByRole("button", { name: "Enviar reporte" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("traduccion", "  texto  ");
  });

  it("RFM-11 a double click calls onSubmit once and shows Enviando reporte...", async () => {
    const user = userEvent.setup();
    const pending = deferred<ReportSubmissionResult>();
    const onSubmit = vi.fn(() => pending.promise);
    const onSuccess = vi.fn();
    renderForm({ onSubmit, onSuccess });
    await user.click(screen.getByLabelText("Traducción"));

    const submit = screen.getByRole("button", { name: "Enviar reporte" });
    act(() => {
      fireEvent.click(submit);
      fireEvent.click(submit);
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const inFlight = screen.getByRole("button", {
      name: "Enviando reporte...",
    });
    expect(inFlight).toBeDisabled();

    await act(async () => {
      pending.resolve({ ok: true });
    });
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("RFM-12 a retryable failure keeps every value and Reintentar resends it", async () => {
    const user = userEvent.setup();
    const onSubmit = vi
      .fn()
      .mockResolvedValueOnce(failure({ retryable: true }))
      .mockResolvedValueOnce({ ok: true });
    const { onSuccess } = renderForm({ onSubmit });
    await user.click(screen.getByLabelText("Otro"));
    await user.type(screen.getByLabelText("Comentario"), "Falta la tilde");

    await user.click(screen.getByRole("button", { name: "Enviar reporte" }));

    expect(screen.getByText("¿Está corriendo la API?")).toBeVisible();
    expect((screen.getByLabelText("Otro") as HTMLInputElement).checked).toBe(
      true,
    );
    expect(
      (screen.getByLabelText("Comentario") as HTMLTextAreaElement).value,
    ).toBe("Falta la tilde");
    const retry = screen.getByRole("button", { name: "Reintentar" });
    expect(retry).toBeEnabled();
    expect(onSubmit).toHaveBeenCalledTimes(1);

    await user.click(retry);

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(onSubmit).toHaveBeenLastCalledWith("otro", "Falta la tilde");
  });

  it("RFM-13 editing a field clears a retryable failure and restores Enviar reporte", async () => {
    const user = userEvent.setup();
    const onSubmit = vi
      .fn()
      .mockResolvedValueOnce(failure({ retryable: true }));
    renderForm({ onSubmit });
    await user.click(screen.getByLabelText("Traducción"));
    await user.click(screen.getByRole("button", { name: "Enviar reporte" }));
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeVisible();

    await user.type(screen.getByLabelText("Comentario"), "x");

    expect(screen.queryByText("¿Está corriendo la API?")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Enviar reporte" }),
    ).toBeVisible();
  });

  it("RFM-14 the first reason radio has focus on mount", async () => {
    renderForm();

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByLabelText("Traducción"));
    });
  });

  it("RFM-15 every control carries touch-target", () => {
    renderForm();

    for (const label of [
      "Traducción",
      "Respuesta incorrecta",
      "Error en el texto",
      "Otro",
    ]) {
      expect(screen.getByLabelText(label).closest("label")).toHaveClass(
        "touch-target",
      );
    }
    expect(screen.getByLabelText("Comentario")).toHaveClass("touch-target");
    expect(screen.getByRole("button", { name: "Enviar reporte" })).toHaveClass(
      "touch-target",
    );
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveClass(
      "touch-target",
    );
    expect(
      screen.getByRole("region", { name: "Reportar pregunta" }),
    ).toBeVisible();
  });

  it("RFM-16 an HTML comment stays literal text", async () => {
    const user = userEvent.setup();
    const { container, onSubmit } = renderForm();
    await user.click(screen.getByLabelText("Otro"));

    fireEvent.change(screen.getByLabelText("Comentario"), {
      target: { value: "<b>Falta</b>" },
    });

    expect(
      (screen.getByLabelText("Comentario") as HTMLTextAreaElement).value,
    ).toBe("<b>Falta</b>");
    expect(container.querySelector("b")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Enviar reporte" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith("otro", "<b>Falta</b>");
    expect(container.querySelector("b")).toBeNull();
  });

  it("RFM-17 the form is keyboard operable", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    const first = screen.getByLabelText("Traducción");
    await waitFor(() => expect(document.activeElement).toBe(first));
    await user.keyboard(" ");
    expect((first as HTMLInputElement).checked).toBe(true);

    const textarea = screen.getByLabelText("Comentario");
    textarea.focus();
    await user.type(textarea, "Falta la tilde");
    expect((textarea as HTMLTextAreaElement).value).toBe("Falta la tilde");

    let reached = false;
    for (let i = 0; i < 10; i += 1) {
      await user.tab();
      if (
        document.activeElement ===
        screen.getByRole("button", {
          name: "Enviar reporte",
        })
      ) {
        reached = true;
        break;
      }
    }
    expect(reached).toBe(true);
    await user.keyboard("{Enter}");
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith("traduccion", "Falta la tilde");
  });

  it("RFM-18 the component never calls fetch", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const pending = deferred<ReportSubmissionResult>();
    renderForm({ onSubmit: vi.fn(() => pending.promise) });
    await user.click(screen.getByLabelText("Traducción"));
    await user.click(screen.getByRole("button", { name: "Enviar reporte" }));
    expect(
      screen.getByRole("button", { name: "Enviando reporte..." }),
    ).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("RFM-19 Cancelar calls onCancel once and sends nothing", async () => {
    const user = userEvent.setup();
    const { onCancel, onSubmit } = renderForm();
    await user.click(screen.getByLabelText("Otro"));
    await user.type(screen.getByLabelText("Comentario"), "Falta la tilde");

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("RFM-20 the unavailable state disables submit, offers no retry and keeps Cancelar", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onSubmit = vi.fn().mockResolvedValue(
      failure({
        message: "La pregunta ya no está disponible.",
        unavailable: true,
      }),
    );
    const view = renderForm({ onCancel, onSubmit });
    await user.click(screen.getByLabelText("Otro"));
    await user.type(screen.getByLabelText("Comentario"), "Falta la tilde");
    await user.click(screen.getByRole("button", { name: "Enviar reporte" }));

    expect(
      screen.getByText("La pregunta ya no está disponible."),
    ).toBeVisible();
    view.rerender(
      <ReportForm
        disabled={false}
        unavailable
        onCancel={onCancel}
        onSuccess={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    expect(
      screen.getByText("La pregunta ya no está disponible."),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Enviar reporte" }),
    ).toBeDisabled();
    expect((screen.getByLabelText("Otro") as HTMLInputElement).checked).toBe(
      true,
    );
    expect(
      (screen.getByLabelText("Comentario") as HTMLTextAreaElement).value,
    ).toBe("Falta la tilde");

    await user.type(screen.getByLabelText("Comentario"), "x");
    expect(
      screen.getByText("La pregunta ya no está disponible."),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Enviar reporte" }),
    ).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("RFM-21 a 422 is editable under Enviar reporte and resends the edited body", async () => {
    const user = userEvent.setup();
    const onSubmit = vi
      .fn()
      .mockResolvedValueOnce(
        failure({
          message: "El reporte no es válido. Revisá el motivo y el comentario.",
          detail: "comentario requerido",
        }),
      )
      .mockResolvedValueOnce({ ok: true });
    renderForm({ onSubmit });
    await user.click(screen.getByLabelText("Otro"));
    await user.type(screen.getByLabelText("Comentario"), "Falta la tilde");

    await user.click(screen.getByRole("button", { name: "Enviar reporte" }));

    expect(
      screen.getByText(
        "El reporte no es válido. Revisá el motivo y el comentario.",
      ),
    ).toBeVisible();
    expect(screen.getByText("comentario requerido")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Enviar reporte" }),
    ).toBeEnabled();
    expect((screen.getByLabelText("Otro") as HTMLInputElement).checked).toBe(
      true,
    );

    await user.clear(screen.getByLabelText("Comentario"));
    await user.type(
      screen.getByLabelText("Comentario"),
      "Falta la tilde corregida",
    );
    expect(screen.queryByText("comentario requerido")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Enviar reporte" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    expect(onSubmit).toHaveBeenLastCalledWith(
      "otro",
      "Falta la tilde corregida",
    );
  });

  it("RFM-22 a validation failure is editable and clears on edit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValueOnce(
      failure({
        message: "Escribí un comentario para el motivo Otro.",
        detail: "detalle",
      }),
    );
    renderForm({ onSubmit });
    await user.click(screen.getByLabelText("Otro"));
    await user.type(screen.getByLabelText("Comentario"), "Falta la tilde");

    await user.click(screen.getByRole("button", { name: "Enviar reporte" }));

    expect(
      screen.getByText("Escribí un comentario para el motivo Otro."),
    ).toBeVisible();
    expect(screen.getByText("detalle")).toBeVisible();
    expect(screen.queryByText("Respuesta inválida del servidor.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Enviar reporte" }),
    ).toBeEnabled();

    await user.type(screen.getByLabelText("Comentario"), "!");
    expect(
      screen.queryByText("Escribí un comentario para el motivo Otro."),
    ).toBeNull();
    expect(screen.queryByText("detalle")).toBeNull();
  });
});
