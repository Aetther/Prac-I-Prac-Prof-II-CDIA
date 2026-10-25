import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Player } from "../game/types";
import { SwitchTurn } from "./SwitchTurn";

const players: readonly [Player, Player] = [
  { name: "Ana", score: 10 },
  { name: "Beto", score: 0 },
];

describe("SwitchTurn", () => {
  it("names the next player and the next round", () => {
    const { rerender } = render(
      <SwitchTurn
        nextPlayerName="Beto"
        nextPlayerIndex={1}
        round={1}
        totalRounds={3}
        players={players}
        onContinue={vi.fn()}
      />,
    );

    expect(screen.getByText("Pasale el dispositivo a Beto")).toBeVisible();
    expect(screen.getByText("Ronda 1 de 3")).toBeVisible();

    rerender(
      <SwitchTurn
        nextPlayerName="Ana"
        nextPlayerIndex={0}
        round={2}
        totalRounds={3}
        players={players}
        onContinue={vi.fn()}
      />,
    );

    expect(screen.getByText("Pasale el dispositivo a Ana")).toBeVisible();
    expect(screen.getByText("Ronda 2 de 3")).toBeVisible();
  });

  it("marks the next player in the scoreboard", () => {
    render(
      <SwitchTurn
        nextPlayerName="Beto"
        nextPlayerIndex={1}
        round={1}
        totalRounds={3}
        players={players}
        onContinue={vi.fn()}
      />,
    );

    const current = screen
      .getAllByRole("listitem")
      .filter((item) => item.getAttribute("aria-current") === "true");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent("Beto: 0 puntos");
  });

  it("calls onContinue from Continuar", async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    render(
      <SwitchTurn
        nextPlayerName="Beto"
        nextPlayerIndex={1}
        round={1}
        totalRounds={3}
        players={players}
        onContinue={onContinue}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("does not reveal the previous feedback", () => {
    render(
      <SwitchTurn
        nextPlayerName="Beto"
        nextPlayerIndex={1}
        round={1}
        totalRounds={3}
        players={players}
        onContinue={vi.fn()}
      />,
    );

    expect(screen.queryByText("Correcta")).toBeNull();
    expect(screen.queryByText("Incorrecta")).toBeNull();
    expect(screen.queryByText(/La respuesta correcta era:/)).toBeNull();
    expect(screen.getByText("Pasale el dispositivo a Beto")).toBeVisible();
  });
});
