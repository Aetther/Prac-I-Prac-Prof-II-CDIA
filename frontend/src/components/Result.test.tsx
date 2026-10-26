import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { GameQuestion } from "../api/types";
import type { LastAnswer, Player, PlayerIndex } from "../game/types";
import { Result } from "./Result";

const question: GameQuestion = {
  id: 42,
  question: "¿Capital de Francia?",
  category: "geografia",
  options: ["Lima", "Quito", "Bogotá", "Buenos Aires"],
  lang: "es",
};

const players: readonly [Player, Player] = [
  { name: "Ana", score: 10 },
  { name: "Beto", score: 0 },
];

const correctAnswer: LastAnswer = {
  chosenAnswer: "Lima",
  correct: true,
  correctAnswer: "Lima",
  timedOut: false,
};

interface Props {
  lastAnswer?: LastAnswer;
  currentPlayer?: PlayerIndex;
  onContinue?: () => void;
}

function renderResult({
  lastAnswer = correctAnswer,
  currentPlayer = 0,
  onContinue = vi.fn(),
}: Props = {}) {
  const view = render(
    <Result
      question={question}
      lastAnswer={lastAnswer}
      players={players}
      currentPlayer={currentPlayer}
      round={1}
      totalRounds={3}
      onContinue={onContinue}
    />,
  );
  return { ...view, onContinue };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Result", () => {
  it("RES-01 shows a correct answer, the points and both actions", () => {
    renderResult();

    expect(screen.getByRole("heading", { name: "Resultado" })).toBeVisible();
    expect(screen.getByText("Correcta")).toBeVisible();
    expect(screen.getByRole("status").textContent).toBe(
      "La respuesta correcta era: Lima",
    );
    expect(screen.getByText("Ana: 10 puntos")).toBeVisible();
    expect(screen.getByRole("button", { name: "Continuar" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Reportar" })).toBeDisabled();
    expect(screen.queryByText(/Elegiste:/)).toBeNull();
    expect(
      screen.queryAllByRole("button", {
        name: /^(Lima|Quito|Bogotá|Buenos Aires)$/,
      }),
    ).toHaveLength(0);
  });

  it("RES-02 shows the wrong click and the correct answer", () => {
    renderResult({
      lastAnswer: {
        chosenAnswer: "Lima",
        correct: false,
        correctAnswer: "Buenos Aires",
        timedOut: false,
      },
    });

    expect(screen.getByText("Incorrecta")).toBeVisible();
    expect(screen.getByText("Elegiste: Lima")).toBeVisible();
    expect(screen.getByRole("status").textContent).toBe(
      "La respuesta correcta era: Buenos Aires",
    );
    expect(screen.getByText("Ana: 10 puntos")).toBeVisible();
    expect(screen.getByText("Beto: 0 puntos")).toBeVisible();
  });

  it("RES-03 shows the question and the scoreboard with the current marker", () => {
    renderResult();

    expect(screen.getByText("¿Capital de Francia?")).toBeVisible();
    expect(screen.getByText("Ana: 10 puntos")).toBeVisible();
    expect(screen.getByText("Beto: 0 puntos")).toBeVisible();
    const current = screen
      .getAllByRole("listitem")
      .filter((item) => item.getAttribute("aria-current") === "true");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent("Ana: 10 puntos");
    expect(current[0]).toHaveTextContent("Turno");
    expect(screen.getAllByText("Turno")).toHaveLength(1);
  });

  it("renders a timeout without an Elegiste sentence", () => {
    renderResult({
      lastAnswer: {
        chosenAnswer: null,
        correct: false,
        correctAnswer: "Buenos Aires",
        timedOut: true,
      },
    });

    expect(screen.getByText("Se acabó el tiempo")).toBeVisible();
    expect(screen.queryByText(/Elegiste:/)).toBeNull();
    expect(screen.getByRole("status").textContent).toBe(
      "La respuesta correcta era: Buenos Aires",
    );
  });

  it("RES-04 shows one status region and the two touch targets", () => {
    renderResult();

    const statuses = screen.getAllByRole("status");
    expect(statuses).toHaveLength(1);
    expect(statuses[0].textContent).toBe("La respuesta correcta era: Lima");
    expect(screen.getByRole("button", { name: "Continuar" })).toHaveClass(
      "touch-target",
    );
    expect(screen.getByRole("button", { name: "Reportar" })).toHaveClass(
      "touch-target",
    );
  });

  it("RES-05 renders the correct answer as text", () => {
    const { container } = renderResult({
      lastAnswer: {
        chosenAnswer: "Lima",
        correct: false,
        correctAnswer: "<b>Lima</b>",
        timedOut: false,
      },
    });

    expect(screen.getByRole("status").textContent).toBe(
      "La respuesta correcta era: <b>Lima</b>",
    );
    expect(container.querySelector("b")).toBeNull();
  });

  it("RES-06 keeps Reportar disabled with its description and makes no call", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { onContinue } = renderResult();

    const report = screen.getByRole("button", { name: "Reportar" });
    expect(report).toBeDisabled();
    expect(report).toHaveAccessibleDescription(
      "Función no disponible todavía.",
    );

    fireEvent.click(report);

    expect(report).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onContinue).not.toHaveBeenCalled();
    expect(screen.getByText("Correcta")).toBeVisible();
    expect(screen.getByText("Ana: 10 puntos")).toBeVisible();
    expect(screen.getByText("Beto: 0 puntos")).toBeVisible();
    expect(screen.getByRole("status").textContent).toBe(
      "La respuesta correcta era: Lima",
    );
  });

  it("RES-07 calls onContinue exactly once", () => {
    const onContinue = vi.fn();
    renderResult({ onContinue });

    const button = screen.getByRole("button", { name: "Continuar" });
    act(() => {
      fireEvent.click(button);
      fireEvent.click(button);
    });

    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("RES-08 never renders a timer", () => {
    renderResult();

    expect(screen.queryByRole("timer")).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByText("Tiempo restante")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe(
      "La respuesta correcta era: Lima",
    );
  });
});
