import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import type { GameQuestion, ReportReason } from "../api/types";
import type { MatchProgress } from "../game/progress";
import type { ReportFailure, ReportSubmissionResult } from "../game/reporting";
import type { LastAnswer, Player, PlayerIndex } from "../game/types";
import { SIX_WHEEL_CATEGORIES } from "../test/wheelFixtures";
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
  progress?: MatchProgress;
  reported?: boolean;
  reporting?: boolean;
  unavailable?: boolean;
  onContinue?: () => void;
  onReport?: (
    reason: ReportReason,
    comment: string,
  ) => Promise<ReportSubmissionResult>;
}

const roundsProgress: MatchProgress = {
  mode: "rounds",
  round: 1,
  totalRounds: 3,
};

const unavailableFailure: ReportFailure = {
  ok: false,
  message: "La pregunta ya no está disponible.",
  retryable: false,
  unavailable: true,
};

function renderResult({
  lastAnswer = correctAnswer,
  currentPlayer = 0,
  progress = roundsProgress,
  reported = false,
  reporting = false,
  unavailable = false,
  onContinue = vi.fn(),
  onReport = vi.fn().mockResolvedValue({ ok: true }),
}: Props = {}) {
  const view = render(
    <Result
      question={question}
      lastAnswer={lastAnswer}
      players={players}
      currentPlayer={currentPlayer}
      progress={progress}
      categories={SIX_WHEEL_CATEGORIES}
      reported={reported}
      reporting={reporting}
      unavailable={unavailable}
      onReport={onReport}
      onContinue={onContinue}
    />,
  );
  return { ...view, onContinue, onReport };
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
    expect(screen.getByRole("button", { name: "Reportar" })).toBeEnabled();
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

  it("RES-16 the old disabled seam is gone and the action opens the form", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { onContinue } = renderResult();

    expect(screen.queryByText("Función no disponible todavía.")).toBeNull();
    const report = screen.getByRole("button", { name: "Reportar" });
    expect(report).toBeEnabled();

    await user.click(report);

    expect(
      screen.getByRole("region", { name: "Reportar pregunta" }),
    ).toBeVisible();
    expect(report).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onContinue).not.toHaveBeenCalled();
    expect(screen.getByText("Resultado")).toBeVisible();
    expect(screen.getByText("¿Capital de Francia?")).toBeVisible();
    expect(screen.getByText("La respuesta correcta era: Lima")).toBeVisible();
    expect(screen.getByRole("button", { name: "Continuar" })).toBeEnabled();
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

  it("RES-09 a six-mode Result shows the chips and no points", () => {
    const { container } = renderResult({
      progress: {
        mode: "six-categories",
        ownedCategories: [["geografia"], []],
        turnsPlayed: [0, 0],
      },
    });

    expect(screen.getByText("Categorías: 1 de 6")).toBeVisible();
    expect(screen.getByText("Límite: 20 turnos por jugador")).toBeVisible();
    expect(screen.getByText("Geografía")).toBeVisible();
    expect(screen.getByText("Geografía").style.backgroundColor).toBe(
      "var(--color-category-geografia)",
    );
    expect(container.textContent).not.toMatch(/puntos/i);
    expect(container.textContent).not.toMatch(/Ronda \d+ de \d+/);
    expect(screen.getByRole("button", { name: "Continuar" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Reportar" })).toBeEnabled();
  });

  it("RES-10 the enabled action opens the inline form and makes no call", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { onReport } = renderResult();

    await user.click(screen.getByRole("button", { name: "Reportar" }));

    expect(
      screen.getByRole("region", { name: "Reportar pregunta" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Reportar" })).toBeDisabled();
    expect(screen.queryAllByRole("dialog")).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onReport).not.toHaveBeenCalled();
    expect(screen.getByText("Resultado")).toBeVisible();
    expect(screen.getByText("¿Capital de Francia?")).toBeVisible();
    expect(screen.getByText("La respuesta correcta era: Lima")).toBeVisible();
    expect(screen.getByRole("button", { name: "Continuar" })).toBeEnabled();
  });

  it("RES-11 a report in flight disables Reportar and the submit with Enviando reporte...", async () => {
    const user = userEvent.setup();
    let resolve!: (value: ReportSubmissionResult) => void;
    const onReport = vi.fn(
      () =>
        new Promise<ReportSubmissionResult>((res) => {
          resolve = res;
        }),
    );
    const view = renderResult({ onReport });
    await user.click(screen.getByRole("button", { name: "Reportar" }));
    await user.click(screen.getByLabelText("Traducción"));
    await user.click(screen.getByRole("button", { name: "Enviar reporte" }));

    view.rerender(
      <Result
        question={question}
        lastAnswer={correctAnswer}
        players={players}
        currentPlayer={0}
        progress={roundsProgress}
        categories={SIX_WHEEL_CATEGORIES}
        reported={false}
        reporting
        unavailable={false}
        onReport={onReport}
        onContinue={view.onContinue}
      />,
    );

    expect(screen.getByRole("button", { name: "Reportar" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Reportar" }),
    ).toHaveAccessibleDescription("Enviando reporte...");
    expect(
      screen.getByRole("button", { name: "Enviando reporte..." }),
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Reportar" }));
    expect(onReport).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolve({ ok: true });
    });
    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: "Reportar pregunta" }),
      ).toBeNull(),
    );
    expect(onReport).toHaveBeenCalledTimes(1);
  });

  it("RES-12 an already reported question is disabled and confirmed", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { onReport } = renderResult({ reported: true });

    const report = screen.getByRole("button", { name: "Reportar" });
    expect(report).toBeDisabled();
    expect(report).toHaveAccessibleDescription("Ya reportaste esta pregunta.");
    expect(screen.getByText("Gracias. Recibimos tu reporte.")).toHaveAttribute(
      "role",
      "status",
    );
    await user.click(report);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onReport).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("region", { name: "Reportar pregunta" }),
    ).toBeNull();
  });

  it("RES-13 Continuar stays enabled with the form open and with a report in flight", async () => {
    const user = userEvent.setup();
    let resolve!: (value: ReportSubmissionResult) => void;
    const onReport = vi.fn(
      () =>
        new Promise<ReportSubmissionResult>((res) => {
          resolve = res;
        }),
    );
    const onContinue = vi.fn();
    renderResult({ onReport, onContinue });
    await user.click(screen.getByRole("button", { name: "Reportar" }));
    expect(screen.getByRole("button", { name: "Continuar" })).toBeEnabled();
    await user.click(screen.getByLabelText("Traducción"));
    await user.click(screen.getByRole("button", { name: "Enviar reporte" }));
    expect(screen.getByRole("button", { name: "Continuar" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(onContinue).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolve({ ok: true });
    });
  });

  it("RES-14 Cancel closes the form, returns focus to Reportar and changes nothing", async () => {
    const user = userEvent.setup();
    const { onReport, onContinue } = renderResult();
    await user.click(screen.getByRole("button", { name: "Reportar" }));
    await user.click(screen.getByLabelText("Otro"));
    await user.type(screen.getByLabelText("Comentario"), "Falta la tilde");

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(
      screen.queryByRole("region", { name: "Reportar pregunta" }),
    ).toBeNull();
    const report = screen.getByRole("button", { name: "Reportar" });
    expect(report).toBeEnabled();
    await waitFor(() => expect(document.activeElement).toBe(report));
    expect(onReport).not.toHaveBeenCalled();
    expect(onContinue).not.toHaveBeenCalled();
    expect(screen.getByText("Correcta")).toBeVisible();
    expect(screen.getByText("Ana: 10 puntos")).toBeVisible();
    expect(screen.getByText("La respuesta correcta era: Lima")).toBeVisible();
  });

  it("RES-15 success moves focus to the confirmation status", async () => {
    const user = userEvent.setup();

    function Harness() {
      const [reported, setReported] = useState(false);
      return (
        <Result
          question={question}
          lastAnswer={correctAnswer}
          players={players}
          currentPlayer={0}
          progress={roundsProgress}
          categories={SIX_WHEEL_CATEGORIES}
          reported={reported}
          reporting={false}
          unavailable={false}
          onReport={() => {
            setReported(true);
            return Promise.resolve({ ok: true });
          }}
          onContinue={vi.fn()}
        />
      );
    }

    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Reportar" }));
    await user.click(screen.getByLabelText("Traducción"));
    await user.click(screen.getByRole("button", { name: "Enviar reporte" }));

    const confirmation = await screen.findByText(
      "Gracias. Recibimos tu reporte.",
    );
    await waitFor(() => expect(document.activeElement).toBe(confirmation));
    expect(confirmation).toHaveAttribute("tabindex", "-1");
    expect(document.activeElement).not.toBe(
      screen.getByRole("button", { name: "Reportar" }),
    );
    expect(screen.queryAllByRole("dialog")).toHaveLength(0);
  });

  it("RES-17 an unavailable question disables Reportar with the unavailable description", async () => {
    const user = userEvent.setup();
    const { onReport } = renderResult({ unavailable: true });

    const report = screen.getByRole("button", { name: "Reportar" });
    expect(report).toBeDisabled();
    expect(report).toHaveAccessibleDescription(
      "La pregunta ya no está disponible.",
    );
    expect(screen.queryByText("Gracias. Recibimos tu reporte.")).toBeNull();
    await user.click(report);
    expect(onReport).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Continuar" })).toBeEnabled();
  });

  it("RES-18 Cancel after a 404 moves focus to Continuar", async () => {
    const user = userEvent.setup();

    function Harness() {
      const [unavailable, setUnavailable] = useState(false);
      return (
        <Result
          question={question}
          lastAnswer={correctAnswer}
          players={players}
          currentPlayer={0}
          progress={roundsProgress}
          categories={SIX_WHEEL_CATEGORIES}
          reported={false}
          reporting={false}
          unavailable={unavailable}
          onReport={() => {
            setUnavailable(true);
            return Promise.resolve(unavailableFailure);
          }}
          onContinue={vi.fn()}
        />
      );
    }

    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Reportar" }));
    await user.click(screen.getByLabelText("Otro"));
    await user.type(screen.getByLabelText("Comentario"), "Falta la tilde");
    await user.click(screen.getByRole("button", { name: "Enviar reporte" }));

    expect(
      within(screen.getByRole("alert")).getByText(
        "La pregunta ya no está disponible.",
      ),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Enviar reporte" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    const cont = screen.getByRole("button", { name: "Continuar" });
    await waitFor(() => expect(document.activeElement).toBe(cont));
    expect(
      screen.queryByRole("region", { name: "Reportar pregunta" }),
    ).toBeNull();
    expect(document.activeElement).not.toBe(
      screen.getByRole("button", { name: "Reportar" }),
    );
    expect(screen.getByRole("button", { name: "Reportar" })).toBeDisabled();
  });
});
