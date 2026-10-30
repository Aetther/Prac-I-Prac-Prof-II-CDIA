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
import type { MatchProgress } from "../game/progress";
import { INITIAL_GAME_STATE } from "../game/reducer";
import type { GameState, Player, PlayerIndex } from "../game/types";
import { SIX_WHEEL_CATEGORIES } from "../test/wheelFixtures";
import { GameScreen } from "./GameScreen";
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

const roundsProgress = {
  mode: "rounds",
  round: 1,
  totalRounds: 3,
} as const;

interface Props {
  question?: GameQuestion;
  lang?: "es" | "en";
  currentPlayer?: PlayerIndex;
  progress?: MatchProgress;
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
  progress = roundsProgress,
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
      progress={progress}
      categories={SIX_WHEEL_CATEGORIES}
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
        progress={roundsProgress}
        categories={SIX_WHEEL_CATEGORIES}
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
        progress={roundsProgress}
        categories={SIX_WHEEL_CATEGORIES}
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
      .map((button) => button.querySelector(".option-text")?.textContent);
    expect(options).toEqual(["Lima", "Quito", "Bogotá", "Buenos Aires"]);
    expect(screen.getByText("Elegí una opción")).toBeVisible();
    expect(screen.queryByText("Correcta")).toBeNull();
    expect(screen.queryByText("Incorrecta")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Opción/ })).toBeNull();
  });

  it('EMOJI-04 the question banner keeps "Categoría: Geografía" in one element with the aria-hidden emoji outside it', () => {
    const { container } = renderCard({ categoryLabel: "Geografía" });

    const sentences = screen.getAllByText("Categoría: Geografía");
    expect(sentences).toHaveLength(1);
    const sentence = sentences[0];
    const banner = sentence.closest(".category-banner");
    expect(banner).not.toBeNull();
    expect(banner).toHaveAttribute("data-category", "geografia");
    const emoji = banner!.querySelector<HTMLElement>('[aria-hidden="true"]');
    expect(emoji).not.toBeNull();
    expect(emoji!.textContent).toBe("🌎");
    expect(sentence).not.toContainElement(emoji);
    const heading = screen.getByRole("heading", {
      name: "¿Capital de Francia?",
    });
    expect(
      banner!.compareDocumentPosition(heading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(container.querySelector("canvas")).toBeNull();
  });

  it("omits the category line when the served label is unknown", () => {
    renderCard({ categoryLabel: null });

    expect(screen.queryByText(/Categoría:/)).toBeNull();
    expect(screen.getByText("¿Capital de Francia?")).toBeVisible();
    expect(screen.getAllByRole("button")).toHaveLength(4);
  });

  it("QC-19 the countdown comes before the question heading in the question card", () => {
    renderCard({ timerActive: true });

    const timer = screen.getByRole("timer", { name: "Tiempo restante" });
    const heading = screen.getByRole("heading", {
      name: "¿Capital de Francia?",
    });
    const firstOption = screen.getAllByRole("button")[0];
    expect(
      timer.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      heading.compareDocumentPosition(firstOption) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByRole("timer")).toBe(timer);
  });

  it("QC-20 the banner precedes the question heading and an unknown label renders no banner", () => {
    const { container, rerender } = renderCard({ categoryLabel: "Geografía" });

    const banner = container.querySelector(".category-banner");
    const heading = screen.getByRole("heading", {
      name: "¿Capital de Francia?",
    });
    expect(banner).not.toBeNull();
    expect(banner!.closest(".game-main")).not.toBeNull();
    expect(
      banner!.compareDocumentPosition(heading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    rerender(
      <QuestionCard
        question={question}
        lang="es"
        players={players}
        currentPlayer={0}
        progress={roundsProgress}
        categories={SIX_WHEEL_CATEGORIES}
        loading={false}
        seconds={20}
        timerActive={false}
        categoryLabel={null}
        onAnswer={vi.fn()}
        onTimeout={vi.fn()}
      />,
    );
    expect(container.querySelector(".category-banner")).toBeNull();
  });

  it("QC-21 the loading question shows its status and no option, timer or banner", () => {
    const baseState: GameState = {
      ...INITIAL_GAME_STATE,
      phase: "QuestionCard",
      config: {
        playerNames: ["Ana", "Beto"],
        lang: "es",
        secondsPerQuestion: 20,
        mode: "rounds",
        rounds: 3,
      },
      players: [
        { name: "Ana", score: 0 },
        { name: "Beto", score: 0 },
      ],
      currentPlayer: 0,
    };
    const props = {
      game: baseState,
      categories: SIX_WHEEL_CATEGORIES,
      loading: true,
      errorMessage: null,
      onStart: vi.fn(),
      onAnswer: vi.fn(),
      onTimeout: vi.fn(),
      onAnswerContinue: vi.fn(),
      onTurnContinue: vi.fn(),
      onChooseCategory: vi.fn(),
      onRetry: vi.fn(),
      onBackToLobby: vi.fn(),
      reportingQuestionId: null,
      unavailableQuestionId: null,
      onReport: vi.fn().mockResolvedValue({ ok: true }),
    };
    const { container, rerender } = render(<GameScreen {...props} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Cargando pregunta...",
    );
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryByRole("timer")).toBeNull();
    expect(container.querySelector(".category-banner")).toBeNull();

    rerender(
      <GameScreen
        {...props}
        game={{ ...baseState, currentQuestion: question }}
        loading={false}
      />,
    );
    expect(screen.getAllByRole("button")).toHaveLength(4);
    expect(screen.getByText("Categoría: Geografía")).toBeVisible();
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
        progress={roundsProgress}
        categories={SIX_WHEEL_CATEGORIES}
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

  it("QC-07 a six-mode QuestionCard shows the six scoreboard and no round", () => {
    const { container } = renderCard({
      progress: {
        mode: "six-categories",
        ownedCategories: [["geografia"], []],
        turnsPlayed: [2, 0],
      },
    });

    expect(screen.getByText("Límite: 20 turnos por jugador")).toBeVisible();
    expect(screen.getByText("Categorías: 1 de 6")).toBeVisible();
    expect(screen.getByText("Turnos: 2 de 20")).toBeVisible();
    expect(container.textContent).not.toMatch(/Ronda \d+ de \d+/);
    expect(screen.getByText("¿Capital de Francia?")).toBeVisible();
    expect(screen.getAllByRole("button")).toHaveLength(4);
    expect(screen.getByText("Elegí una opción")).toBeVisible();
  });

  it("QC-18 the QuestionCard is a game-layout with the scoreboard rail and the options in game-main", () => {
    renderCard();

    const heading = screen.getByRole("heading", {
      name: "¿Capital de Francia?",
    });
    const section = heading.closest("section");
    expect(section).not.toBeNull();
    expect(section).toHaveClass("question-card", "game-layout");

    const rails = section!.querySelectorAll<HTMLElement>(".scoreboard-rail");
    const mains = section!.querySelectorAll<HTMLElement>(".game-main");
    expect(rails).toHaveLength(1);
    expect(mains).toHaveLength(1);
    const rail = rails[0];
    const main = mains[0];

    expect(rail.parentElement).toBe(section);
    expect(main.parentElement).toBe(section);
    expect(
      rail.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    const options = screen.getAllByRole("button");
    expect(options).toHaveLength(4);
    for (const option of options) {
      expect(main).toContainElement(option);
    }
    expect(main).toContainElement(screen.getByText("Elegí una opción"));

    // Positive control: containment is checked in both directions.
    expect(rail).not.toContainElement(options[0]);
    expect(main).not.toContainElement(rail);
  });

  it("The four answers are lettered in API order without changing their names", () => {
    renderCard();
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((button) => button.getAttribute("data-option"))).toEqual(
      ["a", "b", "c", "d"],
    );
    const letters = buttons.map((button) =>
      button.querySelector(".quiz-letter"),
    );
    expect(letters.map((letter) => letter?.textContent)).toEqual([
      "A",
      "B",
      "C",
      "D",
    ]);
    for (const letter of letters) {
      expect(letter).toHaveAttribute("aria-hidden", "true");
    }
    for (const name of ["Lima", "Quito", "Bogotá", "Buenos Aires"]) {
      expect(screen.getByRole("button", { name })).toHaveAccessibleName(name);
    }
    const capsule = document.querySelector(".quiz-question");
    expect(capsule).not.toBeNull();
    expect(capsule!.querySelector("h2.question-text")?.textContent).toBe(
      "¿Capital de Francia?",
    );
    expect(capsule!.querySelector(".quiz-mark")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(capsule!.querySelector(".quiz-mark")?.textContent).toBe("?");
  });

  it("QUIZ-01 the letters follow the API position, not the answer text", () => {
    renderCard({
      question: {
        ...question,
        options: ["Buenos Aires", "Bogotá", "Quito", "Lima"],
      },
    });
    expect(
      screen
        .getByRole("button", { name: "Buenos Aires" })
        .getAttribute("data-option"),
    ).toBe("a");
    expect(
      screen.getByRole("button", { name: "Lima" }).getAttribute("data-option"),
    ).toBe("d");
  });
});
