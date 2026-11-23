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

interface Handlers {
  readonly onRematch: () => void;
  readonly onBackToLobby: () => void;
}

function handlersMock(): Handlers {
  return { onRematch: vi.fn(), onBackToLobby: vi.fn() };
}

function rows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(".scoreboard-row"));
}

function renderRounds(
  result: GameResult,
  roundPlayers = players,
  handlers: Handlers = handlersMock(),
) {
  return render(
    <GameOver
      result={result}
      players={roundPlayers}
      categories={SIX_WHEEL_CATEGORIES}
      ownedCategories={[[], []]}
      turnsPlayed={[0, 0]}
      onRematch={handlers.onRematch}
      onBackToLobby={handlers.onBackToLobby}
    />,
  );
}

function renderSix(
  result: SixCategoriesGameResult,
  ownedCategories: readonly [readonly CategoryName[], readonly CategoryName[]],
  turnsPlayed: readonly [number, number],
  handlers: Handlers = handlersMock(),
) {
  return render(
    <GameOver
      result={result}
      players={sixPlayers}
      categories={SIX_WHEEL_CATEGORIES}
      ownedCategories={ownedCategories}
      turnsPlayed={turnsPlayed}
      onRematch={handlers.onRematch}
      onBackToLobby={handlers.onBackToLobby}
    />,
  );
}

describe("GameOver", () => {
  it("shows ¡Ganó! with both final scores and no ¡Empate!", () => {
    const result: GameResult = {
      kind: "winner",
      winnerIndex: 0,
      scores: [30, 10],
    };
    renderRounds(result);

    expect(screen.getByText("¡Ganó Ana!")).toBeVisible();
    expect(screen.getByText("Ana: 30 puntos")).toBeVisible();
    expect(screen.getByText("Beto: 10 puntos")).toBeVisible();
    expect(screen.queryByText("¡Empate!")).toBeNull();
    expect(screen.queryByText("Límite: 30 turnos por jugador")).toBeNull();
  });

  it("shows ¡Empate! with both scores and no ¡Ganó!", () => {
    const tiedPlayers: readonly [Player, Player] = [
      { name: "Ana", score: 10 },
      { name: "Beto", score: 10 },
    ];
    const result: GameResult = { kind: "tie", scores: [10, 10] };
    renderRounds(result, tiedPlayers);

    expect(screen.getByText("¡Empate!")).toBeVisible();
    expect(screen.getAllByText(/10 puntos/)).toHaveLength(2);
    expect(screen.queryByText(/^Ganó /)).toBeNull();
  });

  it("shows both scores with no turn marker and only the Revancha and Volver al lobby actions", () => {
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
    ).toEqual(["Revancha", "Volver al lobby"]);
    expect(screen.getByText("Ana: 30 puntos")).toBeVisible();
    expect(screen.getByText("Beto: 10 puntos")).toBeVisible();
  });

  it("shows Revancha and Volver al lobby below Fin de la partida in rounds mode", async () => {
    const user = userEvent.setup();
    const handlers = handlersMock();
    const result: GameResult = {
      kind: "winner",
      winnerIndex: 0,
      scores: [30, 10],
    };
    renderRounds(result, players, handlers);

    const end = screen.getByText("Fin de la partida");
    const actions = end.nextElementSibling as HTMLElement;
    expect(actions).toHaveClass("game-over-actions");
    const rematch = within(actions).getByRole("button", { name: "Revancha" });
    const back = within(actions).getByRole("button", {
      name: "Volver al lobby",
    });
    expect(actions.firstElementChild).toBe(rematch);
    expect(rematch).toBeVisible();
    expect(rematch).toHaveClass("button-primary", "touch-target");
    expect(back).toBeVisible();
    expect(back).toHaveClass("button-secondary", "touch-target");

    await user.click(rematch);
    expect(handlers.onRematch).toHaveBeenCalledTimes(1);
    expect(handlers.onBackToLobby).not.toHaveBeenCalled();
    await user.click(back);
    expect(handlers.onBackToLobby).toHaveBeenCalledTimes(1);
    expect(handlers.onRematch).toHaveBeenCalledTimes(1);
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
    expect(screen.getByText("¡Ganó Beto!")).toBeVisible();
  });

  it("GO-01 a six-categories win shows ¡Ganó!, the crowns sentence, the rings and both counts", () => {
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

    expect(screen.getByText("¡Ganó Ana!")).toBeVisible();
    const trophy = screen.getByText("🏆");
    expect(trophy).toHaveAttribute("aria-hidden", "true");
    expect(
      screen.getByRole("heading", { name: "¡Ganó Ana!" }),
    ).not.toContainElement(trophy);
    expect(screen.getByText("Juntó las 6 coronas.")).toBeVisible();
    expect(screen.getByText("Límite: 30 turnos por jugador")).toBeVisible();
    expect(screen.getByText("Coronas: 6 de 6")).toBeVisible();
    expect(screen.getByText("Coronas: 2 de 6")).toBeVisible();
    const [anaRow, betoRow] = rows();
    expect(within(anaRow).getAllByRole("listitem")).toHaveLength(6);
    expect(within(betoRow).getAllByRole("listitem")).toHaveLength(6);
    expect(anaRow.querySelectorAll(".crown-ring-won")).toHaveLength(6);
    expect(betoRow.querySelectorAll(".crown-ring-won")).toHaveLength(2);
    expect(screen.getByText("Fin de la partida")).toBeVisible();
    expect(container.textContent).not.toContain(
      "Se alcanzó el límite de 30 turnos.",
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

    expect(screen.getByText("¡Ganó Ana!")).toBeVisible();
    expect(
      screen.getByText("Se alcanzó el límite de 30 turnos."),
    ).toBeVisible();
    expect(screen.getByText("Coronas: 4 de 6")).toBeVisible();
    expect(screen.getByText("Coronas: 2 de 6")).toBeVisible();
    expect(screen.getAllByText("Turnos: 20 de 30")).toHaveLength(2);
    expect(screen.queryByText("Juntó las 6 coronas.")).toBeNull();
  });

  it("GO-11 equal crowns at the limit decided by correct answers say so", () => {
    render(
      <GameOver
        result={{
          mode: "six-categories",
          kind: "winner",
          winnerIndex: 1,
          categories: [2, 2],
          reason: "turn-limit",
          hits: [8, 10],
        }}
        players={sixPlayers}
        categories={SIX_WHEEL_CATEGORIES}
        ownedCategories={[
          ["geografia", "historia"],
          ["ciencia", "arte"],
        ]}
        categoryHits={[
          { geografia: 3, historia: 3, ciencia: 2 },
          { ciencia: 3, arte: 3, deportes: 2, entretenimiento: 2 },
        ]}
        turnsPlayed={[30, 30]}
        onRematch={vi.fn()}
        onBackToLobby={vi.fn()}
      />,
    );

    expect(screen.getByText("¡Ganó Beto!")).toBeVisible();
    expect(
      screen.getByText(
        "Empataron en coronas: ganó con más aciertos (10 contra 8).",
      ),
    ).toBeVisible();
    expect(screen.queryByText("Se alcanzó el límite de 30 turnos.")).toBeNull();
    const [anaRow, betoRow] = rows();
    expect(
      anaRow.querySelector('.crown-ring[data-category="ciencia"]'),
    ).toHaveAttribute("data-hits", "2");
    expect(
      betoRow.querySelector('.crown-ring[data-category="deportes"]'),
    ).toHaveAttribute("data-hits", "2");
  });

  it("GO-03 a turn-limit tie shows ¡Empate!", () => {
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

    expect(screen.getByText("¡Empate!")).toBeVisible();
    expect(
      screen.getByText("Se alcanzó el límite de 30 turnos."),
    ).toBeVisible();
    expect(screen.getAllByText("Coronas: 3 de 6")).toHaveLength(2);
    expect(screen.getAllByText("Turnos: 20 de 30")).toHaveLength(2);
    expect(screen.queryByText(/^Ganó /)).toBeNull();
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

    expect(screen.getByText("Juntó las 6 coronas.")).toBeVisible();
    expect(container.textContent).not.toContain(
      "Se alcanzó el límite de 30 turnos.",
    );
    expect(screen.getAllByText("Turnos: 19 de 30")).toHaveLength(2);
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
    expect(
      document.querySelectorAll('.crown-ring-won[data-category="geografia"]'),
    ).toHaveLength(2);
    expect(
      document.querySelectorAll('.crown-ring-won[data-category="deportes"]'),
    ).toHaveLength(1);
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

    expect(screen.getByText("¡Ganó Beto!")).toBeVisible();
    expect(screen.getByText("Juntó las 6 coronas.")).toBeVisible();
    expect(screen.getByText("Coronas: 6 de 6")).toBeVisible();
    expect(screen.getByText("Coronas: 2 de 6")).toBeVisible();
    expect(screen.getByText("Turnos: 19 de 30")).toBeVisible();
    expect(screen.getByText("Turnos: 20 de 30")).toBeVisible();
    expect(container.textContent).not.toContain(
      "Se alcanzó el límite de 30 turnos.",
    );
  });

  it("shows Revancha and Volver al lobby below Fin de la partida in six mode", async () => {
    const user = userEvent.setup();
    const handlers = handlersMock();
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
      handlers,
    );

    const end = screen.getByText("Fin de la partida");
    const actions = end.nextElementSibling as HTMLElement;
    expect(actions).toHaveClass("game-over-actions");
    const rematch = within(actions).getByRole("button", { name: "Revancha" });
    const back = within(actions).getByRole("button", {
      name: "Volver al lobby",
    });
    expect(actions.firstElementChild).toBe(rematch);
    expect(rematch).toBeVisible();
    expect(rematch).toHaveClass("button-primary", "touch-target");
    expect(back).toBeVisible();
    expect(back).toHaveClass("button-secondary", "touch-target");

    await user.click(rematch);
    expect(handlers.onRematch).toHaveBeenCalledTimes(1);
    expect(handlers.onBackToLobby).not.toHaveBeenCalled();
    await user.click(back);
    expect(handlers.onBackToLobby).toHaveBeenCalledTimes(1);
    expect(handlers.onRematch).toHaveBeenCalledTimes(1);
  });

  it("GO-07 rounds GameOver shows both player cards with initials and no current marker", () => {
    renderRounds({
      kind: "winner",
      winnerIndex: 0,
      scores: [30, 10],
    });

    const [ana, beto] = rows();
    expect(ana).toHaveClass("scoreboard-card-1");
    expect(beto).toHaveClass("scoreboard-card-2");
    expect(ana.querySelector(".scoreboard-avatar")).toHaveTextContent("A");
    expect(beto.querySelector(".scoreboard-avatar")).toHaveTextContent("B");
    expect(ana.querySelector(".scoreboard-avatar")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(document.querySelectorAll(".scoreboard-card-current")).toHaveLength(
      0,
    );
    expect(screen.queryAllByText("Turno")).toHaveLength(0);
    expect(document.querySelector("[aria-current]")).toBeNull();
    expect(screen.getByText("Ana: 30 puntos")).toBeVisible();
    expect(screen.getByText("Beto: 10 puntos")).toBeVisible();
  });

  it('COPY-02 GameOver shows "¡Ganó Ana!" or "¡Empate!" with the trophy outside the heading', () => {
    const winner = renderRounds({
      kind: "winner",
      winnerIndex: 0,
      scores: [30, 10],
    });
    const heading = screen.getByRole("heading", { name: "¡Ganó Ana!" });
    const trophy = document.querySelector<HTMLElement>(".game-over-trophy");
    expect(trophy).not.toBeNull();
    expect(trophy).toHaveAttribute("aria-hidden", "true");
    expect(heading).not.toContainElement(trophy);
    expect(screen.queryByText("Ganó Ana")).toBeNull();
    winner.unmount();

    renderRounds({ kind: "tie", scores: [10, 10] }, [
      { name: "Ana", score: 10 },
      { name: "Beto", score: 10 },
    ]);
    expect(screen.getByRole("heading", { name: "¡Empate!" })).toBeVisible();
    expect(screen.queryByText("Empate")).toBeNull();
    expect(screen.queryByText(/¡Ganó/)).toBeNull();
  });

  it("ANIM-04 GameOver renders exactly 24 aria-hidden confetti pieces outside the heading and the scoreboard", () => {
    const rounds = renderRounds({
      kind: "winner",
      winnerIndex: 0,
      scores: [30, 10],
    });

    const container = document.querySelector(".game-over-confetti");
    expect(container).not.toBeNull();
    expect(container).toHaveAttribute("aria-hidden", "true");
    const pieces = container!.querySelectorAll(".confetti-piece");
    expect(pieces).toHaveLength(24);
    expect(container!.querySelectorAll("button, a, [tabindex]")).toHaveLength(
      0,
    );
    for (const piece of pieces) {
      expect(piece).toHaveAttribute("aria-hidden", "true");
      expect(piece.getAttribute("style")).toContain("var(--color-category-");
    }
    const heading = screen.getByRole("heading", { name: "¡Ganó Ana!" });
    const scoreboard = screen.getByLabelText("Marcador");
    expect(container!.contains(heading)).toBe(false);
    expect(container!.contains(scoreboard)).toBe(false);
    rounds.unmount();

    const six = renderSix(
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
    expect(
      six.container.querySelectorAll(".game-over-confetti .confetti-piece"),
    ).toHaveLength(24);
  });
});
