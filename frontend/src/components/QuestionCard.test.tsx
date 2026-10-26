import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { GameQuestion } from "../api/types";
import type { Player, PlayerIndex } from "../game/types";
import { QuestionCard } from "./QuestionCard";

const question: GameQuestion = {
  id: 42,
  question: "¿Capital de Francia?",
  category: "geografia",
  options: ["Lima", "Quito", "Bogotá", "Buenos Aires"],
  lang: "es",
};

const players: readonly [Player, Player] = [
  { name: "Ana", score: 0 },
  { name: "Beto", score: 0 },
];

interface Props {
  question?: GameQuestion;
  lang?: "es" | "en";
  currentPlayer?: PlayerIndex;
  loading?: boolean;
  seconds?: number;
  timerActive?: boolean;
  categoryLabel?: string | null;
  onAnswer?: (answer: string) => void;
  onTimeout?: () => void;
}

function renderCard({
  question: cardQuestion = question,
  lang = "es",
  currentPlayer = 0,
  loading = false,
  seconds = 20,
  timerActive = false,
  categoryLabel = null,
  onAnswer = vi.fn(),
  onTimeout = vi.fn(),
}: Props = {}) {
  const view = render(
    <QuestionCard
      question={cardQuestion}
      lang={lang}
      players={players}
      currentPlayer={currentPlayer}
      round={1}
      totalRounds={3}
      loading={loading}
      seconds={seconds}
      timerActive={timerActive}
      categoryLabel={categoryLabel}
      onAnswer={onAnswer}
      onTimeout={onTimeout}
    />,
  );
  return { ...view, onAnswer, onTimeout };
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("QuestionCard", () => {
  it("QC-01 shows the question and timer but no timer without an active question", () => {
    vi.useFakeTimers();
    const { rerender } = renderCard({ timerActive: true });

    expect(screen.getByText("¿Capital de Francia?")).toBeVisible();
    expect(
      screen.getByRole("timer", { name: "Tiempo restante" }),
    ).toHaveTextContent("20 s");

    rerender(
      <QuestionCard
        question={question}
        lang="es"
        players={players}
        currentPlayer={0}
        round={1}
        totalRounds={3}
        loading={false}
        seconds={20}
        timerActive={false}
        categoryLabel={null}
        onAnswer={vi.fn()}
        onTimeout={vi.fn()}
      />,
    );

    expect(screen.queryByRole("timer")).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.getByText("¿Capital de Francia?")).toBeVisible();
  });

  it("QC-02 the first option click locks the question and stops the timer", () => {
    vi.useFakeTimers();
    const onAnswer = vi.fn();
    const onTimeout = vi.fn();
    const { rerender } = renderCard({
      timerActive: true,
      onAnswer,
      onTimeout,
    });

    fireEvent.click(screen.getByRole("button", { name: "Lima" }));

    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith("Lima");
    for (const option of screen.getAllByRole("button")) {
      expect(option).toBeDisabled();
    }

    fireEvent.click(screen.getByRole("button", { name: "Quito" }));
    expect(onAnswer).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(onTimeout).not.toHaveBeenCalled();

    rerender(
      <QuestionCard
        question={question}
        lang="es"
        players={players}
        currentPlayer={0}
        round={1}
        totalRounds={3}
        loading
        seconds={20}
        timerActive={false}
        categoryLabel={null}
        onAnswer={onAnswer}
        onTimeout={onTimeout}
      />,
    );

    expect(screen.getByRole("status").textContent).toBe(
      "Enviando respuesta...",
    );
    expect(screen.queryByRole("timer")).toBeNull();
    for (const option of screen.getAllByRole("button")) {
      expect(option).toBeDisabled();
    }
  });

  it("the expiry path calls onTimeout once and ignores a later click", () => {
    vi.useFakeTimers();
    const onAnswer = vi.fn();
    const onTimeout = vi.fn();
    renderCard({ timerActive: true, onAnswer, onTimeout });

    act(() => {
      vi.advanceTimersByTime(20_000);
    });

    expect(onTimeout).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Lima" }));
    expect(onAnswer).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("QC-03 renders four options in API order and no correct mark", () => {
    renderCard();

    const options = screen
      .getAllByRole("button")
      .map((button) => button.textContent);
    expect(options).toEqual(["Lima", "Quito", "Bogotá", "Buenos Aires"]);
    expect(screen.getByText("Elegí una opción")).toBeVisible();
    expect(screen.queryByText("Correcta")).toBeNull();
    expect(screen.queryByText("Incorrecta")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Opción/ })).toBeNull();
  });

  it("shows the served category label with the question", () => {
    renderCard({ categoryLabel: "Geografía" });

    expect(screen.getByText("Categoría: Geografía")).toBeVisible();
    expect(screen.getByText("¿Capital de Francia?")).toBeVisible();
    expect(screen.getAllByRole("button")).toHaveLength(4);
  });

  it("omits the category line when the served label is unknown", () => {
    renderCard({ categoryLabel: null });

    expect(screen.queryByText(/Categoría:/)).toBeNull();
    expect(screen.getByText("¿Capital de Francia?")).toBeVisible();
    expect(screen.getAllByRole("button")).toHaveLength(4);
  });

  it("QC-05 all option buttons are touch targets", () => {
    renderCard();

    const options = screen.getAllByRole("button");
    expect(options).toHaveLength(4);
    for (const option of options) {
      expect(option.tagName).toBe("BUTTON");
      expect(option).toHaveClass("touch-target");
    }
  });

  it("passes the clicked option text to onAnswer", async () => {
    const user = userEvent.setup();
    const { onAnswer } = renderCard();

    await user.click(screen.getByRole("button", { name: "Quito" }));

    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith("Quito");
  });

  it("shows Sin traducir when Spanish is requested and English returned", () => {
    renderCard({ question: { ...question, lang: "en" }, lang: "es" });

    expect(screen.getByText("Sin traducir")).toBeVisible();
    expect(screen.getByText("¿Capital de Francia?")).toBeVisible();
  });

  it("hides Sin traducir when Spanish is requested and returned", () => {
    renderCard({ question: { ...question, lang: "es" }, lang: "es" });

    expect(screen.queryByText("Sin traducir")).toBeNull();
    expect(screen.getByText("¿Capital de Francia?")).toBeVisible();
  });

  it("hides Sin traducir when English is requested", () => {
    renderCard({ question: { ...question, lang: "en" }, lang: "en" });

    expect(screen.queryByText("Sin traducir")).toBeNull();
    expect(screen.getByText("¿Capital de Francia?")).toBeVisible();
  });

  it("QC-04 disables the options while loading", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    const { rerender } = renderCard({ loading: true, onAnswer });

    for (const option of screen.getAllByRole("button")) {
      expect(option).toBeDisabled();
    }
    expect(screen.getByRole("status").textContent).toBe(
      "Enviando respuesta...",
    );
    expect(screen.queryByRole("timer")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Lima" }));
    expect(onAnswer).not.toHaveBeenCalled();

    rerender(
      <QuestionCard
        question={question}
        lang="es"
        players={players}
        currentPlayer={0}
        round={1}
        totalRounds={3}
        loading={false}
        seconds={20}
        timerActive={false}
        categoryLabel={null}
        onAnswer={onAnswer}
        onTimeout={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Lima" })).toBeEnabled();
    expect(screen.queryByText("Enviando respuesta...")).toBeNull();
  });

  it("renders a script-shaped question as literal text", () => {
    const { container } = renderCard({
      question: { ...question, question: '<script>alert("x")</script>' },
    });

    expect(screen.getByText('<script>alert("x")</script>')).toBeVisible();
    expect(container.querySelector("script")).toBeNull();
  });

  it("marks the current player in the question scoreboard", () => {
    renderCard({ currentPlayer: 0 });

    const current = screen
      .getAllByRole("listitem")
      .filter((item) => item.getAttribute("aria-current") === "true");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent("Ana: 0 puntos");
  });

  it("QC-06 has no inline feedback or Continue", () => {
    renderCard({ timerActive: false });

    expect(screen.queryByText(/La respuesta correcta era:/)).toBeNull();
    expect(screen.queryByText("Correcta")).toBeNull();
    expect(screen.queryByText("Incorrecta")).toBeNull();
    expect(screen.queryByRole("button", { name: "Continuar" })).toBeNull();
    expect(screen.getByText("¿Capital de Francia?")).toBeVisible();
    expect(screen.getAllByRole("button")).toHaveLength(4);
  });
});
