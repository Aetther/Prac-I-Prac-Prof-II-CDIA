import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserEvent } from "@testing-library/user-event";
import App from "./App";
import { ApiError } from "./api/errors";
import { getGameQuestion, submitAnswer } from "./api/game";
import type { GameQuestion, SubmitAnswerResult } from "./api/types";

vi.mock("./api/game", () => ({
  getGameQuestion: vi.fn(),
  submitAnswer: vi.fn(),
}));

const getQuestion = vi.mocked(getGameQuestion);
const postAnswer = vi.mocked(submitAnswer);

function question(overrides: Partial<GameQuestion> = {}): GameQuestion {
  return {
    id: 42,
    question: "¿Capital de Francia?",
    category: "geografia",
    options: ["Lima", "Quito", "Bogotá", "Buenos Aires"],
    lang: "es",
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function networkError(): ApiError {
  return new ApiError(
    "network",
    "Error de conexión. Verificá que la API esté corriendo.",
    {},
  );
}

function notFound(): ApiError {
  return new ApiError("http", "Recurso no encontrado.", { status: 404 });
}

function serverError(): ApiError {
  return new ApiError("http", "Error del servidor.", { status: 500 });
}

function currentTurnRow(): Element[] {
  return screen
    .getAllByRole("listitem")
    .filter((item) => item.getAttribute("aria-current") === "true");
}

async function fillNames(
  user: UserEvent,
  first = "Ana",
  second = "Beto",
): Promise<void> {
  await user.type(screen.getByLabelText("Jugador 1"), first);
  await user.type(screen.getByLabelText("Jugador 2"), second);
}

interface StartOptions {
  first?: string;
  second?: string;
  lang?: "es" | "en";
  seconds?: string;
  rounds?: string;
}

async function startMatch(
  user: UserEvent,
  options: StartOptions = {},
): Promise<void> {
  if (screen.queryByLabelText("Jugador 1") === null) {
    render(<App />);
  }
  const {
    first = "Ana",
    second = "Beto",
    lang,
    seconds,
    rounds = "3",
  } = options;
  await fillNames(user, first, second);
  if (lang) {
    await user.selectOptions(
      screen.getByLabelText("Idioma de las preguntas"),
      lang,
    );
  }
  if (seconds) {
    await user.selectOptions(
      screen.getByLabelText("Tiempo por pregunta"),
      seconds,
    );
  }
  await user.selectOptions(screen.getByLabelText("Rondas"), rounds);
  await user.click(screen.getByRole("button", { name: "Comenzar" }));
}

async function answer(user: UserEvent, option = "Lima"): Promise<void> {
  await user.click(screen.getByRole("button", { name: option }));
}

async function continueFromFeedback(user: UserEvent): Promise<void> {
  await user.click(screen.getByRole("button", { name: "Continuar" }));
}

async function continueFromSwitchTurn(user: UserEvent): Promise<void> {
  await user.click(screen.getByRole("button", { name: "Continuar" }));
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(Math, "random").mockReturnValue(0);
  window.history.pushState({}, "", "/");
  postAnswer.mockResolvedValue({
    correct: false,
    correct_answer: "Buenos Aires",
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("App game flow with a mocked API", () => {
  it("starts with geografia/es and renders the returned question", async () => {
    const user = userEvent.setup();
    getQuestion.mockResolvedValueOnce(question());
    await startMatch(user);

    await screen.findByText("¿Capital de Francia?");
    expect(getQuestion).toHaveBeenCalledTimes(1);
    expect(getQuestion).toHaveBeenCalledWith("geografia", "es");
    const options = screen
      .getAllByRole("button")
      .map((button) => button.textContent);
    expect(options).toEqual(["Lima", "Quito", "Bogotá", "Buenos Aires"]);
  });

  it("makes no request while a name is blank", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("Jugador 1"), "Ana");
    const start = screen.getByRole("button", { name: "Comenzar" });
    expect(start).toBeDisabled();
    await user.click(start);
    expect(getQuestion).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Jugador 2"), "   ");
    expect(start).toBeDisabled();
    await user.click(start);
    expect(getQuestion).not.toHaveBeenCalled();
  });

  it("uses the trimmed names, English and 3 rounds, and stores them observably", async () => {
    const user = userEvent.setup();
    getQuestion.mockResolvedValueOnce(question({ lang: "en" }));
    await startMatch(user, {
      first: " Ana ",
      second: "Beto",
      lang: "en",
      seconds: "30",
      rounds: "3",
    });

    await screen.findByText("¿Capital de Francia?");
    expect(getQuestion).toHaveBeenCalledWith("geografia", "en");
    expect(screen.getByText("Ana: 0 puntos")).toBeVisible();
    expect(screen.getByText("Beto: 0 puntos")).toBeVisible();
    expect(screen.getByText("Ronda 1 de 3")).toBeVisible();
  });

  it("shows the loading status and no option before the question arrives", async () => {
    const user = userEvent.setup();
    const pending = deferred<GameQuestion>();
    getQuestion.mockReturnValueOnce(pending.promise);
    render(<App />);
    await startMatch(user);

    expect(screen.getByRole("status").textContent).toBe("Cargando pregunta...");
    expect(screen.queryByRole("button", { name: "Lima" })).toBeNull();

    pending.resolve(question());
    await screen.findByText("¿Capital de Francia?");
    expect(getQuestion).toHaveBeenCalledTimes(1);
  });

  it("shows Sin traducir and submits with the match language", async () => {
    const user = userEvent.setup();
    getQuestion.mockResolvedValueOnce(question({ id: 42, lang: "en" }));
    postAnswer.mockResolvedValueOnce({
      correct: true,
      correct_answer: "Lima",
    });
    await startMatch(user);

    await screen.findByText("Sin traducir");
    await answer(user);

    expect(postAnswer).toHaveBeenCalledWith(42, "Lima", "es");
    await screen.findByRole("button", { name: "Opción correcta: Lima" });
  });

  it("accepts a recorded id once and skips it on the next load", async () => {
    const user = userEvent.setup();
    getQuestion.mockResolvedValueOnce(
      question({ id: 7, question: "Pregunta 7" }),
    );
    await startMatch(user);
    await screen.findByText("Pregunta 7");
    await answer(user);
    await continueFromFeedback(user);

    getQuestion.mockResolvedValueOnce(
      question({ id: 7, question: "Pregunta 7" }),
    );
    getQuestion.mockResolvedValueOnce(
      question({ id: 8, question: "Pregunta 8" }),
    );
    await continueFromSwitchTurn(user);

    await screen.findByText("Pregunta 8");
    expect(getQuestion).toHaveBeenCalledTimes(3);
  });

  it("shows the duplicate message after five repeats with both error actions", async () => {
    const user = userEvent.setup();
    getQuestion.mockResolvedValueOnce(
      question({ id: 7, question: "Pregunta 7" }),
    );
    postAnswer.mockResolvedValueOnce({
      correct: true,
      correct_answer: "Lima",
    });
    await startMatch(user);
    await screen.findByText("Pregunta 7");
    await answer(user);
    await continueFromFeedback(user);

    getQuestion.mockResolvedValue(question({ id: 7 }));
    await continueFromSwitchTurn(user);

    const alert = await screen.findByRole("alert");
    expect(
      within(alert).getByText("No encontramos una pregunta nueva."),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Volver al lobby" }),
    ).toBeVisible();
    expect(getQuestion).toHaveBeenCalledTimes(6);
  });

  it("retries the duplicate load five more times with the same category", async () => {
    const user = userEvent.setup();
    getQuestion.mockResolvedValueOnce(
      question({ id: 7, question: "Pregunta 7" }),
    );
    postAnswer.mockResolvedValueOnce({
      correct: true,
      correct_answer: "Lima",
    });
    await startMatch(user);
    await screen.findByText("Pregunta 7");
    await answer(user);
    await continueFromFeedback(user);

    getQuestion.mockResolvedValue(question({ id: 7 }));
    await continueFromSwitchTurn(user);
    await screen.findByRole("alert");

    getQuestion.mockReset();
    for (let index = 0; index < 4; index += 1) {
      getQuestion.mockResolvedValueOnce(
        question({ id: 7, question: "Pregunta 7" }),
      );
    }
    getQuestion.mockResolvedValueOnce(
      question({ id: 8, question: "Pregunta 8" }),
    );
    vi.mocked(Math.random).mockReturnValue(0.9);
    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    await screen.findByText("Pregunta 8");
    expect(getQuestion).toHaveBeenCalledTimes(5);
    for (const [category] of getQuestion.mock.calls) {
      expect(category).toBe("geografia");
    }
    expect(screen.getByText("Ana: 10 puntos")).toBeVisible();
    expect(screen.getByText("Beto: 0 puntos")).toBeVisible();
    expect(screen.getByText("Ronda 1 de 3")).toBeVisible();
    expect(currentTurnRow()[0]).toHaveTextContent("Beto: 0 puntos");
  });

  it("keeps the feedback on screen after a correct answer until Continuar", async () => {
    const user = userEvent.setup();
    getQuestion.mockResolvedValueOnce(question());
    postAnswer.mockResolvedValueOnce({
      correct: true,
      correct_answer: "Lima",
    });
    await startMatch(user);
    await screen.findByText("¿Capital de Francia?");
    await answer(user);

    await screen.findByRole("button", { name: "Opción correcta: Lima" });
    expect(screen.getByText("Ana: 10 puntos")).toBeVisible();
    expect(screen.getByText("Correcta")).toBeVisible();
    expect(screen.getByRole("status").textContent).toBe(
      "La respuesta correcta era: Lima",
    );
    expect(screen.queryByText(/Pasale el dispositivo/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Reportar/ })).toBeNull();
    for (const button of screen
      .getAllByRole("button")
      .filter((candidate) => candidate.textContent !== "Continuar")) {
      expect(button).toBeDisabled();
    }
    expect(postAnswer).toHaveBeenCalledTimes(1);
    expect(getQuestion).toHaveBeenCalledTimes(1);

    await continueFromFeedback(user);

    expect(screen.getByText("Pasale el dispositivo a Beto")).toBeVisible();
    expect(screen.getByText("Ronda 1 de 3")).toBeVisible();
    expect(getQuestion).toHaveBeenCalledTimes(1);
    expect(postAnswer).toHaveBeenCalledTimes(1);
  });

  it("issues one submit for a double click", async () => {
    const user = userEvent.setup();
    getQuestion.mockResolvedValueOnce(question());
    const pending = deferred<SubmitAnswerResult>();
    postAnswer.mockReturnValueOnce(pending.promise);
    await startMatch(user);
    await screen.findByText("¿Capital de Francia?");

    const option = screen.getByRole("button", { name: "Lima" });
    act(() => {
      fireEvent.click(option);
      fireEvent.click(option);
    });

    expect(postAnswer).toHaveBeenCalledTimes(1);

    pending.resolve({ correct: true, correct_answer: "Lima" });
    await screen.findByRole("button", { name: "Opción correcta: Lima" });
    expect(screen.getByText("Ana: 10 puntos")).toBeVisible();
    expect(screen.queryByText("Ana: 20 puntos")).toBeNull();
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("marks an incorrect answer and shows the API correct answer", async () => {
    const user = userEvent.setup();
    getQuestion.mockResolvedValueOnce(question());
    postAnswer.mockResolvedValueOnce({
      correct: false,
      correct_answer: "Lima",
    });
    await startMatch(user);
    await screen.findByText("¿Capital de Francia?");
    await answer(user);

    await screen.findByRole("button", { name: "Opción incorrecta: Lima" });
    expect(screen.getByText("Ana: 0 puntos")).toBeVisible();
    expect(screen.getByText("Incorrecta")).toBeVisible();
    expect(screen.getByRole("status").textContent).toBe(
      "La respuesta correcta era: Lima",
    );
    expect(screen.getByRole("button", { name: "Continuar" })).toBeVisible();
  });

  it("moves to player 2 and then to round 2 only after Continuar", async () => {
    const user = userEvent.setup();
    getQuestion.mockResolvedValueOnce(
      question({ id: 1, question: "Pregunta 1" }),
    );
    await startMatch(user);
    await screen.findByText("Pregunta 1");
    await answer(user);

    await screen.findByRole("button", { name: "Continuar" });
    expect(screen.queryByText(/Pasale el dispositivo/)).toBeNull();
    await continueFromFeedback(user);

    expect(screen.getByText("Pasale el dispositivo a Beto")).toBeVisible();
    expect(screen.getByText("Ronda 1 de 3")).toBeVisible();
    expect(currentTurnRow()[0]).toHaveTextContent("Beto: 0 puntos");
    expect(screen.queryByText("Correcta")).toBeNull();
    expect(screen.queryByText(/La respuesta correcta era:/)).toBeNull();

    getQuestion.mockResolvedValueOnce(
      question({ id: 2, question: "Pregunta 2" }),
    );
    await continueFromSwitchTurn(user);
    await screen.findByText("Pregunta 2");
    await answer(user);
    await screen.findByRole("button", { name: "Continuar" });
    await continueFromFeedback(user);

    expect(screen.getByText("Pasale el dispositivo a Ana")).toBeVisible();
    expect(screen.getByText("Ronda 2 de 3")).toBeVisible();
  });

  it("plays a 3-round match with six feedbacks and no call after GameOver", async () => {
    const user = userEvent.setup();
    const correctForPlayerOne = [true, false, true, false, true, false];
    const correctForPlayerTwo = [false, true, false, false, false, false];

    for (let index = 0; index < 6; index += 1) {
      const id = 100 + index;
      getQuestion.mockResolvedValueOnce(
        question({ id, question: `Pregunta ${index + 1}` }),
      );
      if (index === 0) {
        await startMatch(user, { rounds: "3" });
      } else {
        await continueFromSwitchTurn(user);
      }
      await screen.findByText(`Pregunta ${index + 1}`);

      const isPlayerOne = index % 2 === 0;
      postAnswer.mockResolvedValueOnce({
        correct: isPlayerOne
          ? correctForPlayerOne[index]
          : correctForPlayerTwo[index],
        correct_answer: "Lima",
      });
      await answer(user);

      expect(screen.getByRole("button", { name: "Continuar" })).toBeVisible();
      await continueFromFeedback(user);
    }

    expect(screen.getByText("Ganó Ana")).toBeVisible();
    expect(screen.getByText("Ana: 30 puntos")).toBeVisible();
    expect(screen.getByText("Beto: 10 puntos")).toBeVisible();
    expect(screen.queryByText("Turno")).toBeNull();
    expect(getQuestion).toHaveBeenCalledTimes(6);
    expect(postAnswer).toHaveBeenCalledTimes(6);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getQuestion).toHaveBeenCalledTimes(6);
    expect(postAnswer).toHaveBeenCalledTimes(6);
  });

  it("ends a 10–10 match in Empate after the final Continuar", async () => {
    const user = userEvent.setup();
    const correctAnswers = [true, true, false, false, false, false];

    for (let index = 0; index < 6; index += 1) {
      const id = 200 + index;
      getQuestion.mockResolvedValueOnce(
        question({ id, question: `Pregunta ${index + 1}` }),
      );
      if (index === 0) {
        await startMatch(user, { rounds: "3" });
      } else {
        await continueFromSwitchTurn(user);
      }
      await screen.findByText(`Pregunta ${index + 1}`);
      postAnswer.mockResolvedValueOnce({
        correct: correctAnswers[index],
        correct_answer: "Lima",
      });
      await answer(user);
      await screen.findByRole("button", { name: "Continuar" });
      await continueFromFeedback(user);
    }

    expect(screen.getByText("Empate")).toBeVisible();
    expect(screen.getAllByText(/10 puntos/)).toHaveLength(2);
    expect(screen.queryByText(/Ganó/)).toBeNull();
  });

  it("shows the network message and retries the same category", async () => {
    const user = userEvent.setup();
    getQuestion.mockRejectedValueOnce(networkError());
    getQuestion.mockResolvedValueOnce(question());
    await startMatch(user);

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("¿Está corriendo la API?")).toBeVisible();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Volver al lobby" }),
    ).toBeVisible();

    vi.mocked(Math.random).mockReturnValue(0.9);
    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    await screen.findByText("¿Capital de Francia?");
    expect(getQuestion).toHaveBeenCalledTimes(2);
    expect(getQuestion.mock.calls[1]).toEqual(["geografia", "es"]);
  });

  it("shows the timeout message and retries the same question and answer", async () => {
    const user = userEvent.setup();
    const retry = deferred<SubmitAnswerResult>();
    getQuestion.mockResolvedValueOnce(question());
    postAnswer.mockRejectedValueOnce(
      new ApiError("timeout", "La solicitud tardó demasiado tiempo.", {}),
    );
    postAnswer.mockReturnValueOnce(retry.promise);
    await startMatch(user);
    await screen.findByText("¿Capital de Francia?");
    await answer(user);

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("¿Está corriendo la API?")).toBeVisible();
    expect(screen.queryByText("Correcta")).toBeNull();
    expect(screen.queryByText("Incorrecta")).toBeNull();
    expect(screen.queryByText(/La respuesta correcta era:/)).toBeNull();
    expect(screen.queryByText("Ana: 10 puntos")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(
      screen.queryByRole("button", { name: "Opción correcta: Lima" }),
    ).toBeNull();
    expect(screen.queryByText(/La respuesta correcta era:/)).toBeNull();
    expect(screen.queryByText("Ana: 10 puntos")).toBeNull();
    expect(postAnswer).toHaveBeenCalledTimes(2);
    expect(postAnswer.mock.calls[1]).toEqual([42, "Lima", "es"]);

    retry.resolve({ correct: true, correct_answer: "Lima" });
    await screen.findByRole("button", { name: "Opción correcta: Lima" });
    expect(screen.getByText("Ana: 10 puntos")).toBeVisible();
  });

  it("shows the server message for an HTTP 500 and keeps the category", async () => {
    const user = userEvent.setup();
    getQuestion.mockRejectedValueOnce(serverError());
    getQuestion.mockResolvedValueOnce(question());
    await startMatch(user);

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Error del servidor.")).toBeVisible();
    expect(screen.queryByText("¿Está corriendo la API?")).toBeNull();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Volver al lobby" }),
    ).toBeVisible();

    vi.mocked(Math.random).mockReturnValue(0.9);
    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    await screen.findByText("¿Capital de Francia?");
    expect(getQuestion.mock.calls[1]).toEqual(["geografia", "es"]);
  });

  it("issues one retry when Reintentar is clicked twice", async () => {
    const user = userEvent.setup();
    getQuestion.mockRejectedValueOnce(networkError());
    const pending = deferred<GameQuestion>();
    getQuestion.mockReturnValueOnce(pending.promise);
    await startMatch(user);
    await screen.findByRole("alert");

    const retryButton = screen.getByRole("button", { name: "Reintentar" });
    act(() => {
      fireEvent.click(retryButton);
      fireEvent.click(retryButton);
    });

    expect(getQuestion).toHaveBeenCalledTimes(2);
    pending.resolve(question());
    await screen.findByText("¿Capital de Francia?");
  });

  it("retries a submit 404 with the same answer and no question load", async () => {
    const user = userEvent.setup();
    getQuestion.mockResolvedValueOnce(question());
    postAnswer.mockRejectedValueOnce(notFound());
    postAnswer.mockResolvedValueOnce({
      correct: true,
      correct_answer: "Lima",
    });
    await startMatch(user);
    await screen.findByText("¿Capital de Francia?");
    await answer(user);

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Recurso no encontrado.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Volver al lobby" }),
    ).toBeVisible();
    expect(getQuestion).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    await screen.findByRole("button", { name: "Opción correcta: Lima" });
    expect(postAnswer).toHaveBeenCalledTimes(2);
    expect(postAnswer.mock.calls[1]).toEqual([42, "Lima", "es"]);
    expect(getQuestion).toHaveBeenCalledTimes(1);
  });

  it("re-rolls to the next category after a 404 and shows no error", async () => {
    const user = userEvent.setup();
    getQuestion.mockRejectedValueOnce(notFound());
    getQuestion.mockResolvedValueOnce(
      question({
        id: 43,
        category: "historia",
        question: "Pregunta de historia",
      }),
    );
    await startMatch(user);

    await screen.findByText("Pregunta de historia");
    expect(getQuestion).toHaveBeenCalledTimes(2);
    expect(getQuestion.mock.calls[0]).toEqual(["geografia", "es"]);
    expect(getQuestion.mock.calls[1]).toEqual(["historia", "es"]);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the all-six message after exactly six 404 calls", async () => {
    const user = userEvent.setup();
    getQuestion.mockRejectedValue(notFound());
    await startMatch(user);

    const alert = await screen.findByRole("alert");
    expect(
      within(alert).getByText(
        "No hay preguntas disponibles en ninguna categoría.",
      ),
    ).toBeVisible();
    expect(getQuestion).toHaveBeenCalledTimes(6);
    expect(getQuestion.mock.calls.map(([category]) => category)).toEqual([
      "geografia",
      "historia",
      "ciencia",
      "arte",
      "entretenimiento",
      "deportes",
    ]);
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Volver al lobby" }),
    ).toBeVisible();
  });

  it("tries all six categories again when Reintentar follows the all-six error", async () => {
    const user = userEvent.setup();
    getQuestion.mockRejectedValue(notFound());
    await startMatch(user);
    await screen.findByRole("alert");
    expect(getQuestion).toHaveBeenCalledTimes(6);

    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    await screen.findByRole("alert");
    expect(getQuestion).toHaveBeenCalledTimes(12);
    expect(getQuestion.mock.calls[6]).toEqual(["geografia", "es"]);
    expect(
      within(screen.getByRole("alert")).getByText(
        "No hay preguntas disponibles en ninguna categoría.",
      ),
    ).toBeVisible();
  });

  it("re-rolls from a 404 during a retry with three total calls", async () => {
    const user = userEvent.setup();
    getQuestion.mockRejectedValueOnce(networkError());
    getQuestion.mockRejectedValueOnce(notFound());
    getQuestion.mockResolvedValueOnce(
      question({
        id: 43,
        category: "historia",
        question: "Pregunta de historia",
      }),
    );
    await startMatch(user);
    await screen.findByRole("alert");

    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    await screen.findByText("Pregunta de historia");
    expect(getQuestion).toHaveBeenCalledTimes(3);
    expect(getQuestion.mock.calls.map(([category]) => category)).toEqual([
      "geografia",
      "geografia",
      "historia",
    ]);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("starts a fresh duplicate budget after a 404 that ended four duplicates", async () => {
    const user = userEvent.setup();
    getQuestion.mockResolvedValueOnce(
      question({ id: 7, question: "Pregunta 7" }),
    );
    await startMatch(user);

    for (const id of [7, 8, 9, 10]) {
      if (id !== 7) {
        getQuestion.mockResolvedValueOnce(
          question({ id, question: `Pregunta ${id}` }),
        );
        await continueFromSwitchTurn(user);
      }
      await screen.findByText(`Pregunta ${id}`);
      await answer(user);
      await screen.findByRole("button", { name: "Continuar" });
      await continueFromFeedback(user);
    }

    for (const id of [7, 8, 9, 10]) {
      getQuestion.mockResolvedValueOnce(
        question({ id, question: `Pregunta ${id}` }),
      );
    }
    getQuestion.mockRejectedValueOnce(notFound());
    getQuestion.mockResolvedValueOnce(
      question({ id: 11, category: "historia", question: "Pregunta 11" }),
    );
    await continueFromSwitchTurn(user);

    await screen.findByText("Pregunta 11");
    expect(getQuestion).toHaveBeenCalledTimes(10);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("does not try another category after five duplicates", async () => {
    const user = userEvent.setup();
    getQuestion.mockResolvedValueOnce(
      question({ id: 7, question: "Pregunta 7" }),
    );
    await startMatch(user);
    await screen.findByText("Pregunta 7");
    await answer(user);
    await continueFromFeedback(user);

    getQuestion.mockResolvedValue(question({ id: 7 }));
    await continueFromSwitchTurn(user);
    await screen.findByRole("alert");

    expect(getQuestion).toHaveBeenCalledTimes(6);
    for (const [category] of getQuestion.mock.calls) {
      expect(category).toBe("geografia");
    }
  });

  it("returns to the Lobby with defaults and no API call", async () => {
    const user = userEvent.setup();
    getQuestion.mockResolvedValueOnce(question());
    postAnswer.mockResolvedValueOnce({
      correct: true,
      correct_answer: "Lima",
    });
    await startMatch(user);
    await screen.findByText("¿Capital de Francia?");
    await answer(user);
    await screen.findByText("Ana: 10 puntos");
    await continueFromFeedback(user);

    getQuestion.mockRejectedValue(notFound());
    await continueFromSwitchTurn(user);
    await screen.findByRole("alert");
    expect(getQuestion).toHaveBeenCalledTimes(7);
    expect(postAnswer).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Volver al lobby" }));

    expect(screen.getByRole("heading", { name: "Trivia IA" })).toBeVisible();
    expect((screen.getByLabelText("Jugador 1") as HTMLInputElement).value).toBe(
      "",
    );
    expect((screen.getByLabelText("Jugador 2") as HTMLInputElement).value).toBe(
      "",
    );
    expect(
      (screen.getByLabelText("Idioma de las preguntas") as HTMLSelectElement)
        .value,
    ).toBe("es");
    expect(
      (screen.getByLabelText("Tiempo por pregunta") as HTMLSelectElement).value,
    ).toBe("20");
    expect((screen.getByLabelText("Rondas") as HTMLSelectElement).value).toBe(
      "5",
    );
    expect(screen.queryByText("Marcador")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(getQuestion).toHaveBeenCalledTimes(7);
    expect(postAnswer).toHaveBeenCalledTimes(1);
  });

  it("shows no Volver al lobby outside the error screen", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole("heading", { name: "Trivia IA" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Volver al lobby" }),
    ).toBeNull();

    getQuestion.mockResolvedValueOnce(question());
    await startMatch(user);
    await screen.findByText("¿Capital de Francia?");
    expect(
      screen.queryByRole("button", { name: "Volver al lobby" }),
    ).toBeNull();
  });

  it("keeps the score and turn after recovering from the all-six error", async () => {
    const user = userEvent.setup();
    getQuestion.mockResolvedValueOnce(question());
    postAnswer.mockResolvedValueOnce({
      correct: true,
      correct_answer: "Lima",
    });
    await startMatch(user);
    await screen.findByText("¿Capital de Francia?");
    await answer(user);
    await screen.findByText("Ana: 10 puntos");
    await continueFromFeedback(user);

    getQuestion.mockRejectedValue(notFound());
    await continueFromSwitchTurn(user);
    await screen.findByRole("alert");

    getQuestion.mockReset();
    getQuestion.mockRejectedValueOnce(notFound());
    getQuestion.mockResolvedValueOnce(
      question({
        id: 43,
        category: "historia",
        question: "Pregunta de historia",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    await screen.findByText("Pregunta de historia");
    expect(screen.getByText("Ana: 10 puntos")).toBeVisible();
    expect(screen.getByText("Beto: 0 puntos")).toBeVisible();
    expect(screen.getByText("Ronda 1 de 3")).toBeVisible();
    expect(currentTurnRow()[0]).toHaveTextContent("Beto: 0 puntos");
  });
});
