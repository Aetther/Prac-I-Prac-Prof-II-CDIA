import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserEvent } from "@testing-library/user-event";
import App from "./App";
import { ApiError } from "./api/errors";
import { getCategories, getGameQuestion, submitAnswer } from "./api/game";
import type { Category, GameQuestion, SubmitAnswerResult } from "./api/types";
import { installRafQueue } from "./test/rafQueue";
import type { RafQueue } from "./test/rafQueue";
import { FRAME_TIMESTAMPS, SIX_CATEGORIES } from "./test/wheelFixtures";

vi.mock("./api/game", () => ({
  getCategories: vi.fn(),
  getGameQuestion: vi.fn(),
  submitAnswer: vi.fn(),
}));

const getCategoriesMock = vi.mocked(getCategories);
const getQuestion = vi.mocked(getGameQuestion);
const postAnswer = vi.mocked(submitAnswer);

let queue: RafQueue;

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

async function startToWheel(
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
  await screen.findByRole("button", { name: "Girar" });
}

async function spinToResult(user: UserEvent): Promise<void> {
  await user.click(screen.getByRole("button", { name: "Girar" }));
  await act(async () => {
    queue.drive(FRAME_TIMESTAMPS);
  });
  await screen.findByText("Salió: Geografía");
}

async function spinWheel(user: UserEvent): Promise<void> {
  await spinToResult(user);
  await user.click(screen.getByRole("button", { name: "Continuar" }));
}

async function startMatch(
  user: UserEvent,
  options: StartOptions = {},
): Promise<void> {
  await startToWheel(user, options);
  await spinWheel(user);
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

async function continueToWheel(user: UserEvent): Promise<void> {
  await continueFromSwitchTurn(user);
  await screen.findByRole("button", { name: "Girar" });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(Math, "random").mockReturnValue(0);
  queue = installRafQueue();
  window.history.pushState({}, "", "/");
  getCategoriesMock.mockResolvedValue(SIX_CATEGORIES);
  postAnswer.mockResolvedValue({
    correct: false,
    correct_answer: "Buenos Aires",
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("App game flow with a mocked API", () => {
  it("starts with geografia/es and renders the returned question", async () => {
    const user = userEvent.setup();
    getQuestion.mockResolvedValueOnce(question());
    await startMatch(user);

    await screen.findByText("¿Capital de Francia?");
    expect(getCategoriesMock).toHaveBeenCalledTimes(1);
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
    expect(getCategoriesMock).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Jugador 2"), "   ");
    expect(start).toBeDisabled();
    await user.click(start);
    expect(getQuestion).not.toHaveBeenCalled();
    expect(getCategoriesMock).not.toHaveBeenCalled();
  });

  it("uses the trimmed names, English and 3 rounds, and stores them observably", async () => {
    const user = userEvent.setup();
    getQuestion.mockResolvedValueOnce(question({ lang: "en" }));
    await startToWheel(user, {
      first: " Ana ",
      second: "Beto",
      lang: "en",
      seconds: "30",
      rounds: "3",
    });

    expect(
      screen.getByRole("heading", { name: "Girá la ruleta" }),
    ).toBeVisible();
    expect(screen.getByText("Ana: 0 puntos")).toBeVisible();
    expect(screen.getByText("Beto: 0 puntos")).toBeVisible();
    expect(screen.getByText("Ronda 1 de 3")).toBeVisible();
    expect(getQuestion).not.toHaveBeenCalled();

    await spinWheel(user);

    await screen.findByText("¿Capital de Francia?");
    expect(getQuestion).toHaveBeenCalledWith("geografia", "en");
    expect(getCategoriesMock).toHaveBeenCalledTimes(1);
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
    await continueToWheel(user);
    await spinWheel(user);

    await screen.findByText("Pregunta 8");
    expect(getQuestion).toHaveBeenCalledTimes(3);
  });

  it("keeps the spun category when retrying after five duplicate ids", async () => {
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
    await continueToWheel(user);
    await spinWheel(user);

    const alert = await screen.findByRole("alert");
    expect(
      within(alert).getByText("No encontramos una pregunta nueva."),
    ).toBeVisible();

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
    expect(screen.queryByRole("button", { name: "Girar" })).toBeNull();
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

  it("moves to player 2 and then to round 2 through the wheel", async () => {
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
    await continueToWheel(user);
    expect(
      screen.getByRole("heading", { name: "Girá la ruleta" }),
    ).toBeVisible();
    expect(getQuestion).toHaveBeenCalledTimes(1);
    await spinWheel(user);
    await screen.findByText("Pregunta 2");
    await answer(user);
    await screen.findByRole("button", { name: "Continuar" });
    await continueFromFeedback(user);

    expect(screen.getByText("Pasale el dispositivo a Ana")).toBeVisible();
    expect(screen.getByText("Ronda 2 de 3")).toBeVisible();
  });

  it("plays a 3-round match with six spins, six questions and six answers", async () => {
    const user = userEvent.setup();
    const correctForPlayerOne = [true, false, true, false, true, false];
    const correctForPlayerTwo = [false, true, false, false, false, false];

    for (let index = 0; index < 6; index += 1) {
      const id = 100 + index;
      getQuestion.mockResolvedValueOnce(
        question({ id, question: `Pregunta ${index + 1}` }),
      );
      if (index === 0) {
        await startToWheel(user, { rounds: "3" });
      } else {
        await continueToWheel(user);
      }
      await spinWheel(user);
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
    expect(getCategoriesMock).toHaveBeenCalledTimes(1);
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
        await startToWheel(user, { rounds: "3" });
      } else {
        await continueToWheel(user);
      }
      await spinWheel(user);
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
    expect(getCategoriesMock).toHaveBeenCalledTimes(1);

    vi.mocked(Math.random).mockReturnValue(0.9);
    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    await screen.findByText("¿Capital de Francia?");
    expect(getQuestion).toHaveBeenCalledTimes(2);
    expect(getQuestion.mock.calls[1]).toEqual(["geografia", "es"]);
    expect(getCategoriesMock).toHaveBeenCalledTimes(1);
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

  it("shows the all-six message after exactly six calls from the spun category", async () => {
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
    expect(getCategoriesMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Volver al lobby" }),
    ).toBeVisible();
  });

  it("returns to the wheel on Reintentar and tries all six again after a new spin", async () => {
    const user = userEvent.setup();
    getQuestion.mockRejectedValue(notFound());
    await startMatch(user);
    await screen.findByRole("alert");
    expect(getQuestion).toHaveBeenCalledTimes(6);

    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    await screen.findByRole("button", { name: "Girar" });
    expect(getQuestion).toHaveBeenCalledTimes(6);
    expect(getCategoriesMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Ana: 0 puntos")).toBeVisible();
    expect(screen.getByText("Beto: 0 puntos")).toBeVisible();
    expect(currentTurnRow()[0]).toHaveTextContent("Ana: 0 puntos");

    await spinWheel(user);

    const alert = await screen.findByRole("alert");
    expect(getQuestion).toHaveBeenCalledTimes(12);
    expect(
      within(alert).getByText(
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
    await screen.findByText("Pregunta 7");
    await answer(user);
    await continueFromFeedback(user);

    for (const id of [8, 9, 10]) {
      getQuestion.mockResolvedValueOnce(
        question({ id, question: `Pregunta ${id}` }),
      );
      await continueToWheel(user);
      await spinWheel(user);
      await screen.findByText(`Pregunta ${id}`);
      await answer(user);
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
    await continueToWheel(user);
    await spinWheel(user);

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
    await continueToWheel(user);
    await spinWheel(user);
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
    await continueToWheel(user);
    await spinWheel(user);
    await screen.findByRole("alert");
    expect(getQuestion).toHaveBeenCalledTimes(7);
    expect(getCategoriesMock).toHaveBeenCalledTimes(1);
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
    expect(getCategoriesMock).toHaveBeenCalledTimes(1);
    expect(postAnswer).toHaveBeenCalledTimes(1);

    const pending = deferred<Category[]>();
    getCategoriesMock.mockReturnValueOnce(pending.promise);
    await fillNames(user);
    await user.click(screen.getByRole("button", { name: "Comenzar" }));

    expect(screen.getByRole("status").textContent).toBe(
      "Cargando categorías...",
    );

    pending.resolve(SIX_CATEGORIES);
    await screen.findByRole("button", { name: "Girar" });
  });

  it("shows no Volver al lobby outside the error screen", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole("heading", { name: "Trivia IA" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Volver al lobby" }),
    ).toBeNull();

    getQuestion.mockResolvedValueOnce(question());
    await startToWheel(user);

    expect(
      screen.getByRole("heading", { name: "Girá la ruleta" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Volver al lobby" }),
    ).toBeNull();
  });

  it("keeps the score and turn after recovering from the all-six error through the wheel", async () => {
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
    await continueToWheel(user);
    await spinWheel(user);
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
    await screen.findByRole("button", { name: "Girar" });
    await spinWheel(user);

    await screen.findByText("Pregunta de historia");
    expect(screen.getByText("Ana: 10 puntos")).toBeVisible();
    expect(screen.getByText("Beto: 0 puntos")).toBeVisible();
    expect(screen.getByText("Ronda 1 de 3")).toBeVisible();
    expect(currentTurnRow()[0]).toHaveTextContent("Beto: 0 puntos");
  });

  it("starts on the wheel with the six API labels and makes no question call", async () => {
    const user = userEvent.setup();
    await startToWheel(user);

    expect(
      screen.getByRole("heading", { name: "Girá la ruleta" }),
    ).toBeVisible();
    expect(screen.getByRole("img")).toHaveAccessibleDescription(
      "Geografía, Historia, Ciencia, Arte, Entretenimiento, Deportes.",
    );
    expect(currentTurnRow()[0]).toHaveTextContent("Ana: 0 puntos");
    expect(screen.getByRole("button", { name: "Girar" })).toBeVisible();
    expect(getCategoriesMock).toHaveBeenCalledTimes(1);
    expect(getQuestion).not.toHaveBeenCalled();
  });

  it("loads the question only after the spin result is confirmed", async () => {
    const user = userEvent.setup();
    getQuestion.mockResolvedValueOnce(question());
    await startToWheel(user);

    await spinToResult(user);

    expect(screen.getByRole("status").textContent).toBe("Salió: Geografía");
    expect(screen.getByRole("button", { name: "Continuar" })).toBeVisible();
    expect(getQuestion).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(getQuestion).toHaveBeenCalledTimes(1);
    expect(getQuestion).toHaveBeenCalledWith("geografia", "es");
    await screen.findByText("¿Capital de Francia?");
    expect(screen.getByText("Categoría: Geografía")).toBeVisible();
    expect(screen.queryByText("Salió: Geografía")).toBeNull();
  });

  it("shows Cargando categorías... until the labels arrive", async () => {
    const user = userEvent.setup();
    const pending = deferred<Category[]>();
    getCategoriesMock.mockReturnValueOnce(pending.promise);
    render(<App />);
    await fillNames(user);
    await user.click(screen.getByRole("button", { name: "Comenzar" }));

    expect(screen.getByRole("status").textContent).toBe(
      "Cargando categorías...",
    );
    expect(screen.queryByRole("button", { name: "Girar" })).toBeNull();
    expect(getQuestion).not.toHaveBeenCalled();

    pending.resolve(SIX_CATEGORIES);
    await screen.findByRole("button", { name: "Girar" });

    expect(getCategoriesMock).toHaveBeenCalledTimes(1);
    expect(getQuestion).not.toHaveBeenCalled();
  });

  it("retries a network error loading labels and then shows the wheel", async () => {
    const user = userEvent.setup();
    getCategoriesMock.mockRejectedValueOnce(networkError());
    render(<App />);
    await fillNames(user);
    await user.click(screen.getByRole("button", { name: "Comenzar" }));

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("¿Está corriendo la API?")).toBeVisible();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Volver al lobby" }),
    ).toBeVisible();
    expect(getQuestion).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    await screen.findByRole("button", { name: "Girar" });
    expect(getCategoriesMock).toHaveBeenCalledTimes(2);
    expect(getQuestion).not.toHaveBeenCalled();
  });

  it("rejects a malformed label set with the exact server message", async () => {
    const user = userEvent.setup();
    const malformed = SIX_CATEGORIES.map((category) =>
      category.name === "deportes" ? { ...category, name: "musica" } : category,
    );
    getCategoriesMock.mockResolvedValueOnce(malformed);
    render(<App />);
    await fillNames(user);
    await user.click(screen.getByRole("button", { name: "Comenzar" }));

    const alert = await screen.findByRole("alert");
    expect(
      within(alert).getByText("Respuesta inválida del servidor."),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Volver al lobby" }),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Girar" })).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
    expect(getQuestion).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    await screen.findByRole("button", { name: "Girar" });
    expect(getCategoriesMock).toHaveBeenCalledTimes(2);
    expect(getQuestion).not.toHaveBeenCalled();
  });

  it("returns to the Lobby from a labels error without an API call", async () => {
    const user = userEvent.setup();
    const malformed = SIX_CATEGORIES.map((category) =>
      category.name === "deportes" ? { ...category, name: "musica" } : category,
    );
    getCategoriesMock.mockResolvedValueOnce(malformed);
    render(<App />);
    await fillNames(user);
    await user.click(screen.getByRole("button", { name: "Comenzar" }));
    await screen.findByRole("alert");
    expect(getCategoriesMock).toHaveBeenCalledTimes(1);
    expect(getQuestion).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Volver al lobby" }));

    expect(screen.getByRole("heading", { name: "Trivia IA" })).toBeVisible();
    expect((screen.getByLabelText("Jugador 1") as HTMLInputElement).value).toBe(
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
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText("Marcador")).toBeNull();
    expect(getCategoriesMock).toHaveBeenCalledTimes(1);
    expect(getQuestion).not.toHaveBeenCalled();

    const pending = deferred<Category[]>();
    getCategoriesMock.mockReturnValueOnce(pending.promise);
    await fillNames(user);
    await user.click(screen.getByRole("button", { name: "Comenzar" }));

    expect(screen.getByRole("status").textContent).toBe(
      "Cargando categorías...",
    );
    pending.resolve(SIX_CATEGORIES);
    await screen.findByRole("button", { name: "Girar" });
  });

  it("shows the wheel for player 2 after SwitchTurn Continuar", async () => {
    const user = userEvent.setup();
    getQuestion.mockResolvedValueOnce(question());
    postAnswer.mockResolvedValueOnce({
      correct: true,
      correct_answer: "Lima",
    });
    await startMatch(user);
    await screen.findByText("¿Capital de Francia?");
    await answer(user);
    await screen.findByRole("button", { name: "Continuar" });
    await continueFromFeedback(user);

    expect(screen.getByText("Pasale el dispositivo a Beto")).toBeVisible();
    await continueFromSwitchTurn(user);

    await screen.findByRole("button", { name: "Girar" });
    expect(currentTurnRow()[0]).toHaveTextContent("Beto: 0 puntos");
    expect(screen.getByText("Ronda 1 de 3")).toBeVisible();
    expect(getCategoriesMock).toHaveBeenCalledTimes(1);
    expect(getQuestion).toHaveBeenCalledTimes(1);
  });

  it("labels the question with the served category after a 404 fallback", async () => {
    const user = userEvent.setup();
    getQuestion.mockRejectedValueOnce(notFound());
    getQuestion.mockResolvedValueOnce(
      question({
        id: 43,
        category: "historia",
        question: "Pregunta de historia",
      }),
    );
    await startToWheel(user);
    await spinWheel(user);

    await screen.findByText("Pregunta de historia");
    expect(screen.getByText("Categoría: Historia")).toBeVisible();
    expect(screen.queryByText("Categoría: Geografía")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(getQuestion).toHaveBeenCalledTimes(2);
    expect(getQuestion.mock.calls[0]).toEqual(["geografia", "es"]);
    expect(getQuestion.mock.calls[1]).toEqual(["historia", "es"]);
  });

  it("keeps scores, round, turn and used ids across the wheel", async () => {
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

    await continueToWheel(user);

    expect(screen.getByText("Ana: 10 puntos")).toBeVisible();
    expect(screen.getByText("Beto: 0 puntos")).toBeVisible();
    expect(screen.getByText("Ronda 1 de 3")).toBeVisible();
    expect(currentTurnRow()[0]).toHaveTextContent("Beto: 0 puntos");

    await spinToResult(user);

    expect(screen.getByText("Ana: 10 puntos")).toBeVisible();
    expect(screen.getByText("Beto: 0 puntos")).toBeVisible();
    expect(screen.getByText("Ronda 1 de 3")).toBeVisible();
    expect(currentTurnRow()[0]).toHaveTextContent("Beto: 0 puntos");

    getQuestion.mockReset();
    getQuestion.mockResolvedValueOnce(question());
    getQuestion.mockResolvedValueOnce(
      question({ id: 43, question: "Pregunta 43" }),
    );
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    await screen.findByText("Pregunta 43");
    expect(getQuestion).toHaveBeenCalledTimes(2);
    expect(getQuestion.mock.calls.map(([category]) => category)).toEqual([
      "geografia",
      "geografia",
    ]);
  });

  it("starts one question load when Continuar is clicked twice on the result", async () => {
    const user = userEvent.setup();
    getQuestion.mockResolvedValueOnce(question());
    await startToWheel(user);
    await spinToResult(user);

    const continuar = screen.getByRole("button", { name: "Continuar" });
    act(() => {
      fireEvent.click(continuar);
      fireEvent.click(continuar);
    });

    await screen.findByText("¿Capital de Francia?");
    expect(getQuestion).toHaveBeenCalledTimes(1);
  });

  it("does not reload the labels on the next turn or after the match", async () => {
    const user = userEvent.setup();

    for (let index = 0; index < 6; index += 1) {
      const id = 300 + index;
      getQuestion.mockResolvedValueOnce(
        question({ id, question: `Pregunta ${index + 1}` }),
      );
      if (index === 0) {
        await startToWheel(user, { rounds: "3" });
      } else {
        await continueToWheel(user);
      }
      await spinWheel(user);
      await screen.findByText(`Pregunta ${index + 1}`);
      if (index === 1) {
        expect(getCategoriesMock).toHaveBeenCalledTimes(1);
      }
      await answer(user);
      await screen.findByRole("button", { name: "Continuar" });
      await continueFromFeedback(user);
    }

    expect(screen.getByText("Empate")).toBeVisible();
    expect(getCategoriesMock).toHaveBeenCalledTimes(1);
    expect(getQuestion).toHaveBeenCalledTimes(6);
  });

  it("uses the wheel category, not a fresh random pick, when confirming", async () => {
    const user = userEvent.setup();
    getQuestion.mockResolvedValueOnce(question());
    await startToWheel(user);

    await spinToResult(user);
    expect(screen.getByRole("status").textContent).toBe("Salió: Geografía");

    vi.mocked(Math.random).mockReturnValue(0.9);
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    await screen.findByText("¿Capital de Francia?");
    expect(getQuestion).toHaveBeenCalledTimes(1);
    expect(getQuestion).toHaveBeenCalledWith("geografia", "es");
    expect(getQuestion).not.toHaveBeenCalledWith("deportes", "es");
  });
});
