import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { GameResult, Player } from "../game/types";
import { GameOver } from "./GameOver";

const players: readonly [Player, Player] = [
  { name: "Ana", score: 30 },
  { name: "Beto", score: 10 },
];

describe("GameOver", () => {
  it("shows Ganó with both final scores and no Empate", () => {
    const result: GameResult = {
      kind: "winner",
      winnerIndex: 0,
      scores: [30, 10],
    };
    render(<GameOver result={result} players={players} totalRounds={3} />);

    expect(screen.getByText("Ganó Ana")).toBeVisible();
    expect(screen.getByText("Ana: 30 puntos")).toBeVisible();
    expect(screen.getByText("Beto: 10 puntos")).toBeVisible();
    expect(screen.queryByText("Empate")).toBeNull();
  });

  it("shows Empate with both scores and no Ganó", () => {
    const tiedPlayers: readonly [Player, Player] = [
      { name: "Ana", score: 10 },
      { name: "Beto", score: 10 },
    ];
    const result: GameResult = { kind: "tie", scores: [10, 10] };
    render(<GameOver result={result} players={tiedPlayers} totalRounds={3} />);

    expect(screen.getByText("Empate")).toBeVisible();
    expect(screen.getAllByText(/10 puntos/)).toHaveLength(2);
    expect(screen.queryByText(/Ganó/)).toBeNull();
  });

  it("shows both scores with no turn marker and no action", () => {
    const result: GameResult = {
      kind: "winner",
      winnerIndex: 0,
      scores: [30, 10],
    };
    render(<GameOver result={result} players={players} totalRounds={3} />);

    expect(screen.queryAllByText("Turno")).toHaveLength(0);
    expect(document.querySelector("[aria-current]")).toBeNull();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByText("Ana: 30 puntos")).toBeVisible();
    expect(screen.getByText("Beto: 10 puntos")).toBeVisible();
  });

  it("shows Fin de la partida", () => {
    const result: GameResult = {
      kind: "winner",
      winnerIndex: 1,
      scores: [10, 30],
    };
    const losingPlayers: readonly [Player, Player] = [
      { name: "Ana", score: 10 },
      { name: "Beto", score: 30 },
    ];
    render(
      <GameOver result={result} players={losingPlayers} totalRounds={3} />,
    );

    expect(screen.getByText("Fin de la partida")).toBeVisible();
    expect(screen.getByText("Ganó Beto")).toBeVisible();
  });
});
