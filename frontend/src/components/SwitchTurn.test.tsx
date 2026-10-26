import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MatchProgress } from "../game/progress";
import type { Player } from "../game/types";
import { SIX_WHEEL_CATEGORIES } from "../test/wheelFixtures";
import { SwitchTurn } from "./SwitchTurn";

const players: readonly [Player, Player] = [
  { name: "Ana", score: 10 },
  { name: "Beto", score: 0 },
];

const roundsProgress: MatchProgress = {
  mode: "rounds",
  round: 1,
  totalRounds: 3,
};

const roundsProgressTwo: MatchProgress = {
  mode: "rounds",
  round: 2,
  totalRounds: 3,
};

describe("SwitchTurn", () => {
  it("names the next player and the next round", () => {
    const { rerender } = render(
      <SwitchTurn
        nextPlayerName="Beto"
        nextPlayerIndex={1}
        progress={roundsProgress}
        categories={SIX_WHEEL_CATEGORIES}
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
        progress={roundsProgressTwo}
        categories={SIX_WHEEL_CATEGORIES}
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
        progress={roundsProgress}
        categories={SIX_WHEEL_CATEGORIES}
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
        progress={roundsProgress}
        categories={SIX_WHEEL_CATEGORIES}
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
        progress={roundsProgress}
        categories={SIX_WHEEL_CATEGORIES}
        players={players}
        onContinue={vi.fn()}
      />,
    );

    expect(screen.queryByText("Correcta")).toBeNull();
    expect(screen.queryByText("Incorrecta")).toBeNull();
    expect(screen.queryByText(/La respuesta correcta era:/)).toBeNull();
    expect(screen.getByText("Pasale el dispositivo a Beto")).toBeVisible();
  });

  it("SW-05 a six-mode SwitchTurn shows the next player, the limit line and no round", () => {
    const { container } = render(
      <SwitchTurn
        nextPlayerName="Beto"
        nextPlayerIndex={1}
        progress={{
          mode: "six-categories",
          ownedCategories: [["geografia"], ["historia"]],
          turnsPlayed: [1, 0],
        }}
        categories={SIX_WHEEL_CATEGORIES}
        players={players}
        onContinue={vi.fn()}
      />,
    );

    expect(screen.getByText("Pasale el dispositivo a Beto")).toBeVisible();
    expect(screen.getByText("Límite: 20 turnos por jugador")).toBeVisible();
    expect(container.textContent).not.toMatch(/Ronda \d+ de \d+/);
    expect(container.textContent).not.toContain(
      "Se alcanzó el límite de 20 turnos.",
    );
    const current = screen
      .getAllByRole("listitem")
      .filter((item) => item.getAttribute("aria-current") === "true");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent("Beto");
    expect(container.textContent).not.toMatch(/puntos/i);
    expect(screen.queryByText(/La respuesta correcta era:/)).toBeNull();
  });
});
