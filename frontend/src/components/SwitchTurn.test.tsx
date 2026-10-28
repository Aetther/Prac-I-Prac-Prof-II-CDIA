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

    expect(screen.getByText("¡Turno de Beto!")).toBeVisible();
    expect(screen.getByText("Pasale el dispositivo")).toBeVisible();
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

    expect(screen.getByText("¡Turno de Ana!")).toBeVisible();
    expect(screen.getByText("Pasale el dispositivo")).toBeVisible();
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

  it("calls onContinue from Estoy listo", async () => {
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

    await user.click(screen.getByRole("button", { name: "Estoy listo" }));
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
    expect(screen.getByText("¡Turno de Beto!")).toBeVisible();
    expect(screen.getByText("Pasale el dispositivo")).toBeVisible();
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

    expect(screen.getByText("¡Turno de Beto!")).toBeVisible();
    expect(screen.getByText("Pasale el dispositivo")).toBeVisible();
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

  it("PLAYER-04 SwitchTurn shows the large aria-hidden initial for the next player", () => {
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

    const avatar = document.querySelector<HTMLElement>(".switch-turn-avatar");
    expect(avatar).not.toBeNull();
    expect(avatar).toHaveAttribute("aria-hidden", "true");
    expect(avatar).toHaveAttribute("data-player", "2");
    expect(avatar).toHaveTextContent("B");
    expect(
      screen.getByRole("heading", { name: "¡Turno de Beto!" }),
    ).not.toContainElement(avatar);

    rerender(
      <SwitchTurn
        nextPlayerName="Ana"
        nextPlayerIndex={0}
        progress={roundsProgress}
        categories={SIX_WHEEL_CATEGORIES}
        players={players}
        onContinue={vi.fn()}
      />,
    );
    expect(document.querySelector(".switch-turn-avatar")).toHaveTextContent(
      "A",
    );
    expect(document.querySelector(".switch-turn-avatar")).toHaveAttribute(
      "data-player",
      "1",
    );
  });

  it('SWT-01 SwitchTurn shows "¡Turno de Beto!", "Pasale el dispositivo", "Ronda 1 de 3" and "Estoy listo"', async () => {
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

    expect(
      screen.getByRole("heading", { name: "¡Turno de Beto!" }),
    ).toBeVisible();
    expect(screen.getByText("Pasale el dispositivo")).toBeVisible();
    expect(screen.getByText("Ronda 1 de 3")).toBeVisible();
    expect(
      screen.queryByText("Pasale el dispositivo a Beto"),
    ).not.toBeInTheDocument();
    const ready = screen.getByRole("button", { name: "Estoy listo" });
    expect(ready).toHaveClass("button-primary", "touch-target");
    await user.click(ready);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
