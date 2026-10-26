import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { MatchProgress } from "../game/progress";
import { SIX_WHEEL_CATEGORIES } from "../test/wheelFixtures";
import { Scoreboard } from "./Scoreboard";

const players = [
  { name: "Ana", score: 10 },
  { name: "Beto", score: 0 },
] as const;

const roundsProgress: MatchProgress = {
  mode: "rounds",
  round: 1,
  totalRounds: 3,
};

function rows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(".scoreboard-row"));
}

describe("Scoreboard", () => {
  it("shows both names and scores in points", () => {
    render(
      <Scoreboard
        players={players}
        currentPlayer={0}
        progress={roundsProgress}
        categories={SIX_WHEEL_CATEGORIES}
      />,
    );

    expect(screen.getByText("Ana: 10 puntos")).toBeVisible();
    expect(screen.getByText("Beto: 0 puntos")).toBeVisible();
  });

  it("marks only the current player with Turno and aria-current", () => {
    render(
      <Scoreboard
        players={players}
        currentPlayer={1}
        progress={roundsProgress}
        categories={SIX_WHEEL_CATEGORIES}
      />,
    );

    const turno = screen.getAllByText("Turno");
    expect(turno).toHaveLength(1);
    const row = turno[0].closest("li");
    expect(row).toHaveAttribute("aria-current", "true");
    expect(row).toHaveTextContent("Beto: 0 puntos");
    expect(
      rows().filter((item) => item.hasAttribute("aria-current")),
    ).toHaveLength(1);
  });

  it("shows the current round out of the total", () => {
    render(
      <Scoreboard
        players={players}
        currentPlayer={0}
        progress={{ mode: "rounds", round: 2, totalRounds: 3 }}
        categories={SIX_WHEEL_CATEGORIES}
      />,
    );

    expect(screen.getByText("Ronda 2 de 3")).toBeVisible();
  });

  it("renders no Turno marker when no current player is given", () => {
    render(
      <Scoreboard
        players={players}
        progress={roundsProgress}
        categories={SIX_WHEEL_CATEGORIES}
      />,
    );

    expect(screen.queryAllByText("Turno")).toHaveLength(0);
    expect(screen.getByText("Ana: 10 puntos")).toBeVisible();
    expect(screen.getByText("Beto: 0 puntos")).toBeVisible();
  });

  it("SB-03 the six scoreboard shows the limit line, both counts and no round", () => {
    const sixProgress: MatchProgress = {
      mode: "six-categories",
      ownedCategories: [["geografia"], []],
      turnsPlayed: [2, 0],
    };
    const { container, rerender } = render(
      <Scoreboard
        players={players}
        currentPlayer={0}
        progress={sixProgress}
        categories={SIX_WHEEL_CATEGORIES}
      />,
    );

    expect(screen.getByText("Límite: 20 turnos por jugador")).toBeVisible();
    expect(screen.getByText("Categorías: 1 de 6")).toBeVisible();
    expect(screen.getByText("Turnos: 2 de 20")).toBeVisible();
    expect(screen.getByText("Categorías: 0 de 6")).toBeVisible();
    expect(screen.getByText("Turnos: 0 de 20")).toBeVisible();
    expect(container.textContent).not.toMatch(/Ronda \d+ de \d+/);

    rerender(
      <Scoreboard
        players={players}
        currentPlayer={0}
        progress={roundsProgress}
        categories={SIX_WHEEL_CATEGORIES}
      />,
    );

    expect(container.textContent).toMatch(/Ronda 1 de 3/);
  });

  it("SB-04 the six scoreboard scopes each chip to its player", () => {
    render(
      <Scoreboard
        players={players}
        progress={{
          mode: "six-categories",
          ownedCategories: [["geografia"], ["historia"]],
          turnsPlayed: [0, 0],
        }}
        categories={SIX_WHEEL_CATEGORIES}
      />,
    );

    const [anaRow, betoRow] = rows();
    expect(within(anaRow).getByText("Geografía")).toBeVisible();
    expect(within(anaRow).queryByText("Historia")).toBeNull();
    expect(within(betoRow).getByText("Historia")).toBeVisible();
    expect(within(betoRow).queryByText("Geografía")).toBeNull();
  });

  it("SB-05 six mode marks only the current player", () => {
    render(
      <Scoreboard
        players={players}
        currentPlayer={0}
        progress={{
          mode: "six-categories",
          ownedCategories: [["geografia"], ["historia"]],
          turnsPlayed: [0, 0],
        }}
        categories={SIX_WHEEL_CATEGORIES}
      />,
    );

    expect(screen.getAllByText("Turno")).toHaveLength(1);
    const current = rows().filter(
      (row) => row.getAttribute("aria-current") === "true",
    );
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent("Ana");
    const [anaRow, betoRow] = rows();
    expect(within(anaRow).getByText("Turno")).toBeVisible();
    expect(within(betoRow).queryByText("Turno")).toBeNull();
    expect(betoRow).not.toHaveAttribute("aria-current");
  });

  it("SB-06 six mode renders no current marker without a currentPlayer", () => {
    render(
      <Scoreboard
        players={players}
        progress={{
          mode: "six-categories",
          ownedCategories: [["geografia"], ["historia"]],
          turnsPlayed: [0, 0],
        }}
        categories={SIX_WHEEL_CATEGORIES}
      />,
    );

    expect(screen.queryAllByText("Turno")).toHaveLength(0);
    expect(document.querySelector("[aria-current]")).toBeNull();
    expect(screen.getByText("Ana")).toBeVisible();
    expect(screen.getByText("Beto")).toBeVisible();
    expect(screen.getByText("Geografía")).toBeVisible();
    expect(screen.getByText("Historia")).toBeVisible();
  });

  it("SB-07 six mode renders no points", () => {
    const { container, rerender } = render(
      <Scoreboard
        players={players}
        currentPlayer={0}
        progress={{
          mode: "six-categories",
          ownedCategories: [["geografia"], []],
          turnsPlayed: [2, 0],
        }}
        categories={SIX_WHEEL_CATEGORIES}
      />,
    );

    expect(container.textContent).not.toMatch(/puntos/i);
    expect(container.textContent).not.toMatch(/(Ana|Beto): \d+/);

    rerender(
      <Scoreboard
        players={players}
        currentPlayer={0}
        progress={roundsProgress}
        categories={SIX_WHEEL_CATEGORIES}
      />,
    );

    expect(container.textContent).toMatch(/Ana: 10 puntos/);
  });

  it("SB-08 a player with no categories shows the empty state", () => {
    render(
      <Scoreboard
        players={players}
        progress={{
          mode: "six-categories",
          ownedCategories: [["geografia"], []],
          turnsPlayed: [0, 0],
        }}
        categories={SIX_WHEEL_CATEGORIES}
      />,
    );

    const [anaRow, betoRow] = rows();
    expect(within(betoRow).getByText("Sin categorías")).toBeVisible();
    expect(within(betoRow).getByText("Categorías: 0 de 6")).toBeVisible();
    expect(betoRow.querySelectorAll(".category-chip")).toHaveLength(0);
    expect(anaRow.querySelectorAll(".category-chip")).toHaveLength(1);
    expect(within(anaRow).queryByText("Sin categorías")).toBeNull();
  });

  it("SB-09 the six scoreboard renders the completed-turn boundary", () => {
    const { container } = render(
      <Scoreboard
        players={players}
        progress={{
          mode: "six-categories",
          ownedCategories: [
            ["geografia", "historia", "ciencia", "arte"],
            ["deportes", "entretenimiento"],
          ],
          turnsPlayed: [20, 19],
        }}
        categories={SIX_WHEEL_CATEGORIES}
      />,
    );

    expect(screen.getByText("Turnos: 20 de 20")).toBeVisible();
    expect(screen.getByText("Turnos: 19 de 20")).toBeVisible();
    expect(container.textContent).not.toContain(
      "Se alcanzó el límite de 20 turnos.",
    );
    expect(container.textContent).not.toMatch(/Ronda \d+ de \d+/);
    expect(screen.getByText("Ana")).toBeVisible();
    expect(screen.getByText("Beto")).toBeVisible();
  });
});
