import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Scoreboard } from "./Scoreboard";

const players = [
  { name: "Ana", score: 10 },
  { name: "Beto", score: 0 },
] as const;

describe("Scoreboard", () => {
  it("shows both names and scores in points", () => {
    render(
      <Scoreboard
        players={players}
        currentPlayer={0}
        round={1}
        totalRounds={3}
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
        round={1}
        totalRounds={3}
      />,
    );

    const turno = screen.getAllByText("Turno");
    expect(turno).toHaveLength(1);
    const row = turno[0].closest("li");
    expect(row).toHaveAttribute("aria-current", "true");
    expect(row).toHaveTextContent("Beto: 0 puntos");
    expect(
      screen
        .getAllByRole("listitem")
        .filter((item) => item.hasAttribute("aria-current")),
    ).toHaveLength(1);
  });

  it("shows the current round out of the total", () => {
    render(
      <Scoreboard
        players={players}
        currentPlayer={0}
        round={2}
        totalRounds={3}
      />,
    );

    expect(screen.getByText("Ronda 2 de 3")).toBeVisible();
  });

  it("renders no Turno marker when no current player is given", () => {
    render(<Scoreboard players={players} round={1} totalRounds={3} />);

    expect(screen.queryAllByText("Turno")).toHaveLength(0);
    expect(screen.getByText("Ana: 10 puntos")).toBeVisible();
    expect(screen.getByText("Beto: 0 puntos")).toBeVisible();
  });
});
