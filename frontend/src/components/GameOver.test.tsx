import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
  CategoryName,
  GameResult,
  Player,
  SixCategoriesGameResult,
} from "../game/types";
import { SIX_WHEEL_CATEGORIES } from "../test/wheelFixtures";
import { GameOver } from "./GameOver";

const players: readonly [Player, Player] = [
  { name: "Ana", score: 30 },
  { name: "Beto", score: 10 },
];

const sixPlayers: readonly [Player, Player] = [
  { name: "Ana", score: 0 },
  { name: "Beto", score: 0 },
];

const five: readonly CategoryName[] = [
  "geografia",
  "historia",
  "ciencia",
  "arte",
  "entretenimiento",
];

function rows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(".scoreboard-row"));
}

function renderRounds(
  result: GameResult,
  roundPlayers = players,
  onPlayAgain = vi.fn(),
) {
  return render(
    <GameOver
      result={result}
      players={roundPlayers}
      categories={SIX_WHEEL_CATEGORIES}
      ownedCategories={[[], []]}
      turnsPlayed={[0, 0]}
      onPlayAgain={onPlayAgain}
    />,
  );
}

function renderSix(
  result: SixCategoriesGameResult,
  ownedCategories: readonly [readonly CategoryName[], readonly CategoryName[]],
  turnsPlayed: readonly [number, number],
  onPlayAgain = vi.fn(),
) {
  return render(
    <GameOver
      result={result}
      players={sixPlayers}
      categories={SIX_WHEEL_CATEGORIES}
      ownedCategories={ownedCategories}
      turnsPlayed={turnsPlayed}
      onPlayAgain={onPlayAgain}
    />,
  );
}

describe("GameOver", () => {
  it("shows Ganó with both final scores and no Empate", () => {
    const result: GameResult = {
      kind: "winner",
      winnerIndex: 0,
      scores: [30, 10],
    };
    renderRounds(result);

    expect(screen.getByText("Ganó Ana")).toBeVisible();
    expect(screen.getByText("Ana: 30 puntos")).toBeVisible();
    expect(screen.getByText("Beto: 10 puntos")).toBeVisible();
    expect(screen.queryByText("Empate")).toBeNull();
    expect(screen.queryByText("Límite: 20 turnos por jugador")).toBeNull();
  });

  it("shows Empate with both scores and no Ganó", () => {
    const tiedPlayers: readonly [Player, Player] = [
      { name: "Ana", score: 10 },
      { name: "Beto", score: 10 },
    ];
    const result: GameResult = { kind: "tie", scores: [10, 10] };
    renderRounds(result, tiedPlayers);

    expect(screen.getByText("Empate")).toBeVisible();
    expect(screen.getAllByText(/10 puntos/)).toHaveLength(2);
    expect(screen.queryByText(/Ganó/)).toBeNull();
  });

  it("shows both scores with no turn marker and only the Jugar de nuevo action", () => {
    const result: GameResult = {
      kind: "winner",
      winnerIndex: 0,
      scores: [30, 10],
    };
    renderRounds(result);

    expect(screen.queryAllByText("Turno")).toHaveLength(0);
    expect(document.querySelector("[aria-current]")).toBeNull();
    expect(
      screen.getAllByRole("button").map((button) => button.textContent),
    ).toEqual(["Jugar de nuevo"]);
    expect(screen.getByText("Ana: 30 puntos")).toBeVisible();
    expect(screen.getByText("Beto: 10 puntos")).toBeVisible();
  });

  it("shows a touch-target Jugar de nuevo below Fin de la partida in rounds mode", async () => {
    const user = userEvent.setup();
    const onPlayAgain = vi.fn();
    const result: GameResult = {
      kind: "winner",
      winnerIndex: 0,
      scores: [30, 10],
    };
    renderRounds(result, players, onPlayAgain);

    const end = screen.getByText("Fin de la partida");
    const button = screen.getByRole("button", { name: "Jugar de nuevo" });
    expect(button).toBeVisible();
    expect(button).toHaveClass("touch-target");
    expect(end.nextElementSibling).toBe(button);

    await user.click(button);
    expect(onPlayAgain).toHaveBeenCalledTimes(1);
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
    renderRounds(result, losingPlayers);

    expect(screen.getByText("Fin de la partida")).toBeVisible();
    expect(screen.getByText("Ganó Beto")).toBeVisible();
  });

  it("GO-01 a six-categories win shows Ganó, the category sentence, the chips and both counts", () => {
    const { container } = renderSix(
      {
        mode: "six-categories",
        kind: "winner",
        winnerIndex: 0,
        categories: [6, 2],
        reason: "six-categories",
      },
      [
        [...five, "deportes"],
        ["geografia", "historia"],
      ],
      [19, 19],
    );

    expect(screen.getByText("Ganó Ana")).toBeVisible();
    expect(screen.getByText("Juntó las 6 categorías.")).toBeVisible();
    expect(screen.getByText("Límite: 20 turnos por jugador")).toBeVisible();
    expect(screen.getByText("Categorías: 6 de 6")).toBeVisible();
    expect(screen.getByText("Categorías: 2 de 6")).toBeVisible();
    const [anaRow, betoRow] = rows();
    expect(within(anaRow).getAllByRole("listitem")).toHaveLength(6);
    expect(within(betoRow).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Fin de la partida")).toBeVisible();
    expect(container.textContent).not.toContain(
      "Se alcanzó el límite de 20 turnos.",
    );
    expect(container.textContent).not.toMatch(/puntos/i);
    expect(screen.queryAllByText("Turno")).toHaveLength(0);
    expect(document.querySelector("[aria-current]")).toBeNull();
  });

  it("GO-02 a turn-limit winner shows the limit sentence and both twenty counts", () => {
    renderSix(
      {
        mode: "six-categories",
        kind: "winner",
        winnerIndex: 0,
        categories: [4, 2],
        reason: "turn-limit",
      },
      [
        ["geografia", "historia", "ciencia", "arte"],
        ["deportes", "entretenimiento"],
      ],
      [20, 20],
    );

    expect(screen.getByText("Ganó Ana")).toBeVisible();
    expect(
      screen.getByText("Se alcanzó el límite de 20 turnos."),
    ).toBeVisible();
    expect(screen.getByText("Categorías: 4 de 6")).toBeVisible();
    expect(screen.getByText("Categorías: 2 de 6")).toBeVisible();
    expect(screen.getAllByText("Turnos: 20 de 20")).toHaveLength(2);
    expect(screen.queryByText("Juntó las 6 categorías.")).toBeNull();
  });

  it("GO-03 a turn-limit tie shows Empate", () => {
    renderSix(
      {
        mode: "six-categories",
        kind: "tie",
        categories: [3, 3],
        reason: "turn-limit",
      },
      [
        ["geografia", "historia", "ciencia"],
        ["arte", "entretenimiento", "deportes"],
      ],
      [20, 20],
    );

    expect(screen.getByText("Empate")).toBeVisible();
    expect(
      screen.getByText("Se alcanzó el límite de 20 turnos."),
    ).toBeVisible();
    expect(screen.getAllByText("Categorías: 3 de 6")).toHaveLength(2);
    expect(screen.getAllByText("Turnos: 20 de 20")).toHaveLength(2);
    expect(screen.queryByText(/^Ganó/)).toBeNull();
  });

  it("GO-04 a sixth category before the limit shows only the category sentence", () => {
    const { container } = renderSix(
      {
        mode: "six-categories",
        kind: "winner",
        winnerIndex: 0,
        categories: [6, 2],
        reason: "six-categories",
      },
      [
        [...five, "deportes"],
        ["geografia", "historia"],
      ],
      [19, 19],
    );

    expect(screen.getByText("Juntó las 6 categorías.")).toBeVisible();
    expect(container.textContent).not.toContain(
      "Se alcanzó el límite de 20 turnos.",
    );
    expect(screen.getAllByText("Turnos: 19 de 20")).toHaveLength(2);
  });

  it("GO-05 six-mode GameOver has no current player and no points", () => {
    const { container } = renderSix(
      {
        mode: "six-categories",
        kind: "winner",
        winnerIndex: 0,
        categories: [6, 2],
        reason: "six-categories",
      },
      [
        [...five, "deportes"],
        ["geografia", "historia"],
      ],
      [19, 19],
    );

    expect(screen.queryAllByText("Turno")).toHaveLength(0);
    expect(document.querySelector("[aria-current]")).toBeNull();
    expect(container.textContent).not.toMatch(/puntos/i);
    expect(container.textContent).not.toMatch(/(Ana|Beto): \d+/);
    expect(screen.getByText("Ana")).toBeVisible();
    expect(screen.getByText("Beto")).toBeVisible();
    expect(screen.getAllByText("Geografía")).toHaveLength(2);
    expect(screen.getByText("Deportes")).toBeVisible();
  });

  it("GO-06 player 2's sixth category on the last turn wins with one fewer completed turn", () => {
    const { container } = renderSix(
      {
        mode: "six-categories",
        kind: "winner",
        winnerIndex: 1,
        categories: [2, 6],
        reason: "six-categories",
      },
      [
        ["geografia", "historia"],
        [...five, "deportes"],
      ],
      [20, 19],
    );

    expect(screen.getByText("Ganó Beto")).toBeVisible();
    expect(screen.getByText("Juntó las 6 categorías.")).toBeVisible();
    expect(screen.getByText("Categorías: 6 de 6")).toBeVisible();
    expect(screen.getByText("Categorías: 2 de 6")).toBeVisible();
    expect(screen.getByText("Turnos: 19 de 20")).toBeVisible();
    expect(screen.getByText("Turnos: 20 de 20")).toBeVisible();
    expect(container.textContent).not.toContain(
      "Se alcanzó el límite de 20 turnos.",
    );
  });

  it("shows a touch-target Jugar de nuevo below Fin de la partida in six mode", async () => {
    const user = userEvent.setup();
    const onPlayAgain = vi.fn();
    renderSix(
      {
        mode: "six-categories",
        kind: "winner",
        winnerIndex: 0,
        categories: [6, 2],
        reason: "six-categories",
      },
      [
        [...five, "deportes"],
        ["geografia", "historia"],
      ],
      [19, 19],
      onPlayAgain,
    );

    const end = screen.getByText("Fin de la partida");
    const button = screen.getByRole("button", { name: "Jugar de nuevo" });
    expect(button).toBeVisible();
    expect(button).toHaveClass("touch-target");
    expect(end.nextElementSibling).toBe(button);

    await user.click(button);
    expect(onPlayAgain).toHaveBeenCalledTimes(1);
  });
});
