import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorScreen } from "./ErrorScreen";

describe("ErrorScreen", () => {
  it("shows the message in role=alert with touch-target Reintentar and Volver al lobby", () => {
    render(
      <ErrorScreen
        message="¿Está corriendo la API?"
        onRetry={vi.fn()}
        onBackToLobby={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "¿Está corriendo la API?",
    );
    const retry = screen.getByRole("button", { name: "Reintentar" });
    const back = screen.getByRole("button", { name: "Volver al lobby" });
    expect(retry).toHaveClass("touch-target");
    expect(back).toHaveClass("touch-target");
  });

  it("calls onRetry from Reintentar", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const onBackToLobby = vi.fn();
    render(
      <ErrorScreen
        message="Error del servidor."
        onRetry={onRetry}
        onBackToLobby={onBackToLobby}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onBackToLobby).not.toHaveBeenCalled();
  });

  it("calls onBackToLobby from Volver al lobby", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const onBackToLobby = vi.fn();
    render(
      <ErrorScreen
        message="Error del servidor."
        onRetry={onRetry}
        onBackToLobby={onBackToLobby}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Volver al lobby" }));
    expect(onBackToLobby).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });
});
