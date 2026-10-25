import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { GameQuestion } from "../api/types";
import type { LastAnswer, Player, PlayerIndex } from "../game/types";
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
  feedback?: LastAnswer | null;
  onAnswer?: (answer: string) => void;
  onContinue?: () => void;
}

function renderCard({
  question: cardQuestion = question,
  lang = "es",
  currentPlayer = 0,
  loading = false,
  feedback = null,
  onAnswer = vi.fn(),
  onContinue = vi.fn(),
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
      feedback={feedback}
      onAnswer={onAnswer}
      onContinue={onContinue}
    />,
  );
  return { ...view, onAnswer, onContinue };
}

describe("QuestionCard", () => {
  it("renders the question and the four options in API order with nothing marked", () => {
    renderCard();

    expect(screen.getByText("¿Capital de Francia?")).toBeVisible();
    const options = screen
      .getAllByRole("button")
      .map((button) => button.textContent);
    expect(options).toEqual(["Lima", "Quito", "Bogotá", "Buenos Aires"]);
    expect(screen.getByText("Elegí una opción")).toBeVisible();
    expect(screen.queryByText("Correcta")).toBeNull();
    expect(screen.queryByText("Incorrecta")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Opción/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Continuar" })).toBeNull();
  });

  it("renders the options as touch-target buttons", () => {
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

  it("disables the options and announces Enviando respuesta... while loading", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    const { rerender } = renderCard({ loading: true, onAnswer });

    for (const option of screen.getAllByRole("button")) {
      expect(option).toBeDisabled();
    }
    expect(screen.getByRole("status").textContent).toBe(
      "Enviando respuesta...",
    );
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
        feedback={null}
        onAnswer={onAnswer}
        onContinue={vi.fn()}
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

  it("marks the chosen correct option and shows the API answer in a status sentence", () => {
    renderCard({
      feedback: {
        chosenAnswer: "Lima",
        correct: true,
        correctAnswer: "Lima",
      },
    });

    const chosen = screen.getByRole("button", {
      name: "Opción correcta: Lima",
    });
    expect(within(chosen).getByText("Correcta")).toBeVisible();
    expect(screen.getByRole("status").textContent).toBe(
      "La respuesta correcta era: Lima",
    );
    expect(screen.getByRole("button", { name: "Continuar" })).toBeVisible();
  });

  it("marks the chosen incorrect option and shows the API answer", () => {
    renderCard({
      feedback: {
        chosenAnswer: "Lima",
        correct: false,
        correctAnswer: "Buenos Aires",
      },
    });

    const chosen = screen.getByRole("button", {
      name: "Opción incorrecta: Lima",
    });
    expect(within(chosen).getByText("Incorrecta")).toBeVisible();
    expect(screen.getByRole("status").textContent).toBe(
      "La respuesta correcta era: Buenos Aires",
    );
    expect(screen.getByRole("button", { name: "Continuar" })).toBeVisible();
  });

  it("marks from feedback.correct even when the API answer differs from the click", () => {
    renderCard({
      feedback: {
        chosenAnswer: "Lima",
        correct: true,
        correctAnswer: "Buenos Aires",
      },
    });

    expect(
      screen.getByRole("button", { name: "Opción correcta: Lima" }),
    ).toBeVisible();
    expect(screen.getByText("Correcta")).toBeVisible();
    expect(screen.getByRole("status").textContent).toBe(
      "La respuesta correcta era: Buenos Aires",
    );
  });

  it("keeps all four options disabled after the feedback appears", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    renderCard({
      feedback: {
        chosenAnswer: "Lima",
        correct: true,
        correctAnswer: "Lima",
      },
      onAnswer,
    });

    const options = [
      screen.getByRole("button", { name: "Opción correcta: Lima" }),
      screen.getByRole("button", { name: "Quito" }),
      screen.getByRole("button", { name: "Bogotá" }),
      screen.getByRole("button", { name: "Buenos Aires" }),
    ];
    for (const option of options) {
      expect(option).toBeDisabled();
    }
    await user.click(options[1]);
    expect(onAnswer).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Continuar" })).toBeEnabled();
  });

  it("shows no Reportar action with Continuar and the sentence visible", () => {
    renderCard({
      feedback: {
        chosenAnswer: "Lima",
        correct: true,
        correctAnswer: "Lima",
      },
    });

    expect(screen.queryByRole("button", { name: /Reportar/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Continuar" })).toBeVisible();
    expect(screen.getByRole("status").textContent).toBe(
      "La respuesta correcta era: Lima",
    );
  });

  it("calls onContinue from a touch-target Continuar button", async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    renderCard({
      feedback: {
        chosenAnswer: "Lima",
        correct: true,
        correctAnswer: "Lima",
      },
      onContinue,
    });

    const button = screen.getByRole("button", { name: "Continuar" });
    expect(button).toHaveClass("touch-target");
    await user.click(button);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("renders a script-shaped correct answer as literal text", () => {
    const { container } = renderCard({
      feedback: {
        chosenAnswer: "Lima",
        correct: false,
        correctAnswer: "<b>Lima</b>",
      },
    });

    expect(screen.getByRole("status").textContent).toBe(
      "La respuesta correcta era: <b>Lima</b>",
    );
    expect(container.querySelector("b")).toBeNull();
  });

  it("marks only the chosen option", () => {
    renderCard({
      feedback: {
        chosenAnswer: "Lima",
        correct: true,
        correctAnswer: "Buenos Aires",
      },
    });

    const marked = screen
      .getAllByRole("button")
      .filter((button) =>
        (button.getAttribute("aria-label") ?? "").startsWith("Opción"),
      );
    expect(marked).toHaveLength(1);
    expect(marked[0]).toHaveAccessibleName("Opción correcta: Lima");
    expect(screen.getByRole("button", { name: "Quito" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Bogotá" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Buenos Aires" })).toBeVisible();
  });
});
