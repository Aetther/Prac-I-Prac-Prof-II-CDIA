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

function ringOf(row: HTMLElement, category: string): HTMLElement {
  const node = row.querySelector<HTMLElement>(
    `.crown-ring[data-category="${category}"]`,
  );
  if (node === null) throw new Error(`no ${category} ring`);
  return node;
}

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

    expect(screen.getByText("Límite: 30 turnos por jugador")).toBeVisible();
    expect(screen.getByText("Coronas: 1 de 6")).toBeVisible();
    expect(screen.getByText("Turnos: 2 de 30")).toBeVisible();
    expect(screen.getByText("Coronas: 0 de 6")).toBeVisible();
    expect(screen.getByText("Turnos: 0 de 30")).toBeVisible();
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

  it("SB-04 the six scoreboard scopes each ring to its player", () => {
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
    expect(ringOf(anaRow, "geografia")).toHaveClass("crown-ring-won");
    expect(ringOf(anaRow, "historia")).not.toHaveClass("crown-ring-won");
    expect(ringOf(betoRow, "historia")).toHaveClass("crown-ring-won");
    expect(ringOf(betoRow, "geografia")).not.toHaveClass("crown-ring-won");
    expect(
      within(anaRow).getByText("Geografía: corona ganada"),
    ).toBeInTheDocument();
  });

  it("SB-13 the rings show each player's correct answers by thirds and the crown rule", () => {
    render(
      <Scoreboard
        players={players}
        progress={{
          mode: "six-categories",
          ownedCategories: [["ciencia"], []],
          categoryHits: [{ geografia: 2, ciencia: 3 }, { historia: 1 }],
          turnsPlayed: [0, 0],
        }}
        categories={SIX_WHEEL_CATEGORIES}
      />,
    );

    expect(screen.getByText("Corona = 3 aciertos por categoría")).toBeVisible();
    const [anaRow, betoRow] = rows();
    expect(
      screen.getByRole("list", { name: "Coronas de Ana" }),
    ).toBeInTheDocument();
    expect(within(anaRow).getAllByRole("listitem")).toHaveLength(6);
    const geografia = ringOf(anaRow, "geografia");
    expect(geografia).toHaveAttribute("data-hits", "2");
    expect(geografia.style.getPropertyValue("--ring-fill")).toMatch(/^66\.6/);
    expect(geografia.style.getPropertyValue("--ring-color")).toBe(
      "var(--color-category-geografia)",
    );
    expect(
      within(anaRow).getByText("Geografía: 2 de 3 aciertos"),
    ).toBeInTheDocument();
    expect(ringOf(anaRow, "ciencia")).toHaveClass("crown-ring-won");
    expect(ringOf(anaRow, "ciencia")).toHaveTextContent("👑");
    expect(ringOf(anaRow, "arte")).toHaveAttribute("data-hits", "0");
    expect(ringOf(betoRow, "historia")).toHaveAttribute("data-hits", "1");
    expect(
      ringOf(anaRow, "geografia").querySelector(".crown-ring-count"),
    ).toHaveTextContent("2/3");
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
    const [anaRow, betoRow] = rows();
    expect(ringOf(anaRow, "geografia")).toHaveClass("crown-ring-won");
    expect(ringOf(betoRow, "historia")).toHaveClass("crown-ring-won");
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

  it("SB-08 a player with no crowns shows six empty rings", () => {
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
    expect(within(betoRow).getByText("Coronas: 0 de 6")).toBeVisible();
    expect(betoRow.querySelectorAll('.crown-ring[data-hits="0"]')).toHaveLength(
      6,
    );
    expect(anaRow.querySelectorAll(".crown-ring-won")).toHaveLength(1);
    expect(betoRow.querySelectorAll(".crown-ring-won")).toHaveLength(0);
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

    expect(screen.getByText("Turnos: 20 de 30")).toBeVisible();
    expect(screen.getByText("Turnos: 19 de 30")).toBeVisible();
    expect(container.textContent).not.toContain(
      "Se alcanzó el límite de 30 turnos.",
    );
    expect(container.textContent).not.toMatch(/Ronda \d+ de \d+/);
    expect(screen.getByText("Ana")).toBeVisible();
    expect(screen.getByText("Beto")).toBeVisible();
  });

  it("SB-10 the six progress strings are each the text of one scoreboard-stat element", () => {
    const sixProgress: MatchProgress = {
      mode: "six-categories",
      ownedCategories: [["geografia"], []],
      turnsPlayed: [2, 0],
    };
    const { rerender } = render(
      <Scoreboard
        players={players}
        currentPlayer={0}
        progress={sixProgress}
        categories={SIX_WHEEL_CATEGORIES}
      />,
    );

    const categorias = screen.getAllByText("Coronas: 1 de 6");
    const turnos = screen.getAllByText("Turnos: 2 de 30");
    expect(categorias).toHaveLength(1);
    expect(turnos).toHaveLength(1);
    expect(categorias[0]).toHaveClass("scoreboard-stat");
    expect(turnos[0]).toHaveClass("scoreboard-stat");
    expect(categorias[0]).not.toBe(turnos[0]);

    for (const stat of document.querySelectorAll<HTMLElement>(
      ".scoreboard-stat",
    )) {
      const text = stat.textContent ?? "";
      expect(
        text.includes("Coronas: 1 de 6") && text.includes("Turnos: 2 de 30"),
      ).toBe(false);
    }

    rerender(
      <Scoreboard
        players={players}
        currentPlayer={0}
        progress={roundsProgress}
        categories={SIX_WHEEL_CATEGORIES}
      />,
    );

    // Positive control: the same class query finds the rounds score.
    expect(screen.getByText("Ana: 10 puntos")).toHaveClass("scoreboard-stat");
  });

  it("SB-11 the six row keeps two stats per player outside the ring list", () => {
    render(
      <Scoreboard
        players={players}
        currentPlayer={0}
        progress={{
          mode: "six-categories",
          ownedCategories: [
            [
              "geografia",
              "historia",
              "ciencia",
              "arte",
              "entretenimiento",
              "deportes",
            ],
            [],
          ],
          turnsPlayed: [2, 0],
        }}
        categories={SIX_WHEEL_CATEGORIES}
      />,
    );

    const [anaRow, betoRow] = rows();
    const anaStats = Array.from(
      anaRow.querySelectorAll<HTMLElement>(".scoreboard-stat"),
    );
    expect(anaStats).toHaveLength(2);
    expect(anaRow.querySelectorAll(".crown-progress")).toHaveLength(1);
    expect(anaRow.querySelectorAll(".crown-ring-won")).toHaveLength(6);
    for (const stat of anaStats) {
      expect(stat.closest(".crown-progress")).toBeNull();
    }
    expect(anaStats.map((stat) => stat.textContent)).toEqual([
      "Coronas: 6 de 6",
      "Turnos: 2 de 30",
    ]);

    // Positive control: Beto's row has its own two stats and no crown yet.
    expect(betoRow.querySelectorAll(".scoreboard-stat")).toHaveLength(2);
    expect(betoRow.querySelectorAll(".crown-progress")).toHaveLength(1);
    expect(betoRow.querySelectorAll(".crown-ring-won")).toHaveLength(0);
  });

  it("SB-12 the rounds total keeps the exact copy and a wrapping class while the six stats stay nowrap", () => {
    const longName = "Ana María de los Ángeles Fernández López";
    const longPlayers = [
      { name: longName, score: 10 },
      { name: "Beto", score: 0 },
    ] as const;
    const { rerender } = render(
      <Scoreboard
        players={longPlayers}
        currentPlayer={0}
        progress={roundsProgress}
        categories={SIX_WHEEL_CATEGORIES}
      />,
    );

    const roundsTotal = screen.getByText(`${longName}: 10 puntos`);
    expect(roundsTotal).toHaveTextContent(`${longName}: 10 puntos`);
    expect(roundsTotal).toHaveClass(
      "scoreboard-stat",
      "scoreboard-rounds-total",
    );

    rerender(
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

    const sixStats = [
      screen.getByText("Coronas: 1 de 6"),
      screen.getByText("Turnos: 2 de 30"),
    ];
    for (const stat of sixStats) {
      expect(stat).toHaveClass("scoreboard-stat");
      expect(stat).not.toHaveClass("scoreboard-rounds-total");
    }
  });

  it("PLAYER-02 each scoreboard card holds an aria-hidden initial and the exact points string", () => {
    render(
      <Scoreboard
        players={players}
        currentPlayer={0}
        progress={roundsProgress}
        categories={SIX_WHEEL_CATEGORIES}
      />,
    );

    const [ana, beto] = rows();
    expect(ana).toHaveClass("scoreboard-card-1");
    expect(beto).toHaveClass("scoreboard-card-2");
    expect(ana).toHaveAttribute("data-player", "1");
    expect(beto).toHaveAttribute("data-player", "2");
    const anaAvatar = ana.querySelector(".scoreboard-avatar");
    const betoAvatar = beto.querySelector(".scoreboard-avatar");
    expect(anaAvatar).toHaveAttribute("aria-hidden", "true");
    expect(betoAvatar).toHaveAttribute("aria-hidden", "true");
    expect(anaAvatar).toHaveTextContent("A");
    expect(betoAvatar).toHaveTextContent("B");
    expect(screen.getAllByText("Ana: 10 puntos")).toHaveLength(1);
    expect(screen.getAllByText("Beto: 0 puntos")).toHaveLength(1);
  });

  it('PLAYER-03 the acting card is marked by the glow class, "Turno" and aria-current, never by colour alone', () => {
    const { unmount } = render(
      <Scoreboard
        players={players}
        currentPlayer={0}
        progress={roundsProgress}
        categories={SIX_WHEEL_CATEGORIES}
      />,
    );

    const [ana, beto] = rows();
    expect(ana).toHaveClass("scoreboard-card-current");
    expect(ana).toHaveTextContent("Turno");
    expect(ana).toHaveAttribute("aria-current", "true");
    expect(beto).not.toHaveClass("scoreboard-card-current");
    expect(beto).not.toHaveTextContent("Turno");
    expect(beto).not.toHaveAttribute("aria-current");
    unmount();

    render(
      <Scoreboard
        players={players}
        progress={roundsProgress}
        categories={SIX_WHEEL_CATEGORIES}
      />,
    );
    expect(document.querySelectorAll(".scoreboard-card-current")).toHaveLength(
      0,
    );
    expect(document.querySelector("[aria-current]")).toBeNull();
  });

  it("PLAYER-05 the six-mode card keeps its two stats and rings while carrying the initial and its player class", () => {
    render(
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

    const [ana, beto] = rows();
    expect(ana).toHaveClass("scoreboard-card-1");
    expect(beto).toHaveClass("scoreboard-card-2");
    expect(ana.querySelector(".scoreboard-avatar")).toHaveTextContent("A");
    expect(beto.querySelector(".scoreboard-avatar")).toHaveTextContent("B");
    expect(ana.querySelectorAll(".scoreboard-stat")).toHaveLength(2);
    expect(ana.querySelectorAll(".crown-progress")).toHaveLength(1);
    expect(ana).not.toHaveTextContent("puntos");
    expect(beto.querySelectorAll(".crown-ring-won")).toHaveLength(0);
  });
});
