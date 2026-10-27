import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminKeyGate } from "./AdminKeyGate";

function renderGate({
  verifying = false,
  error = null,
  onSubmit = vi.fn(),
}: {
  verifying?: boolean;
  error?: string | null;
  onSubmit?: (apiKey: string) => void;
} = {}) {
  const view = render(
    <AdminKeyGate verifying={verifying} error={error} onSubmit={onSubmit} />,
  );
  return { ...view, onSubmit };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AdminKeyGate", () => {
  it("AUTH-01 renders the labelled password field, the hint and the disabled submit", () => {
    renderGate();

    const input = screen.getByLabelText("Clave de administración");
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveAttribute("autocomplete", "off");
    const hintId = input.getAttribute("aria-describedby");
    expect(hintId).not.toBeNull();
    expect(document.getElementById(String(hintId))).toHaveTextContent(
      "Se guarda solo en la memoria de esta pestaña. Si recargás la página, tenés que volver a ingresarla.",
    );
    expect(
      screen.getByText(
        "Ingresá la clave de administración para revisar los reportes.",
      ),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Ingresar" })).toBeDisabled();
    expect(
      screen.queryByRole("heading", { name: "Reportes" }),
    ).not.toBeInTheDocument();
  });

  it("AUTH-02 Ingresar is disabled while the trimmed value is empty", async () => {
    const user = userEvent.setup();
    renderGate();

    const input = screen.getByLabelText("Clave de administración");
    const button = screen.getByRole("button", { name: "Ingresar" });
    expect(button).toBeDisabled();

    await user.type(input, "   ");
    expect(button).toBeDisabled();

    await user.type(input, "c");
    expect(button).toBeEnabled();
    expect(input).toHaveClass("touch-target");
    expect(button).toHaveClass("touch-target");
  });

  it("AUTH-03 submits the trimmed value exactly once", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderGate();

    await user.type(
      screen.getByLabelText("Clave de administración"),
      "  clave  ",
    );
    await user.click(screen.getByRole("button", { name: "Ingresar" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("clave");
    expect(onSubmit).not.toHaveBeenCalledWith("  clave  ");
  });

  it("AUTH-04 verifying disables the field and the button and reads Verificando...", () => {
    renderGate({ verifying: true });

    expect(screen.getByLabelText("Clave de administración")).toBeDisabled();
    const button = screen.getByRole("button", { name: "Verificando..." });
    expect(button).toBeDisabled();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("AUTH-05 an error is a role=alert region and returns focus to the field, keeping its value", async () => {
    const user = userEvent.setup();
    const { rerender } = renderGate();
    const input = screen.getByLabelText("Clave de administración");

    await user.type(input, "mala");
    rerender(
      <AdminKeyGate
        verifying={false}
        error="La clave no es válida."
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "La clave no es válida.",
    );
    await waitFor(() => expect(document.activeElement).toBe(input));
    expect((input as HTMLInputElement).value).toBe("mala");
  });

  it("AUTH-06 Enter in the field submits once", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderGate();
    const input = screen.getByLabelText("Clave de administración");

    await user.type(input, "clave{Enter}");

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("clave");
  });

  it("AUTH-07 every gate control carries touch-target and never calls fetch", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    renderGate();

    const input = screen.getByLabelText("Clave de administración");
    const button = screen.getByRole("button", { name: "Ingresar" });
    expect(input).toHaveClass("touch-target");
    expect(button).toHaveClass("touch-target");

    await user.type(input, "clave{Enter}");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
