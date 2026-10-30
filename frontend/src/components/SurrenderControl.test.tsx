import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SurrenderControl } from "./SurrenderControl";

function renderControl() {
  const onSurrender = vi.fn();
  render(
    <SurrenderControl
      playerName="Ana"
      opponentName="Beto"
      onSurrender={onSurrender}
    />,
  );
  return onSurrender;
}

describe("SurrenderControl", () => {
  it("Cancelling keeps the match", async () => {
    const user = userEvent.setup();
    const onSurrender = renderControl();
    const button = screen.getByRole("button", { name: "Rendirse" });
    expect(button).toHaveClass("touch-target");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await user.click(button);
    const dialog = screen.getByRole("alertdialog", {
      name: "¿Seguro que querés rendirte, Ana? Gana Beto.",
    });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Rendirse" })).toHaveFocus();
    expect(onSurrender).not.toHaveBeenCalled();
  });

  it("SURC-01 confirming calls onSurrender once", async () => {
    const user = userEvent.setup();
    const onSurrender = renderControl();
    await user.click(screen.getByRole("button", { name: "Rendirse" }));
    await user.click(screen.getByRole("button", { name: "Sí, me rindo" }));
    expect(onSurrender).toHaveBeenCalledTimes(1);
  });
});
