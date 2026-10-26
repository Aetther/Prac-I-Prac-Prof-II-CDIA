import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
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

function scoreboardRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(".scoreboard-row"));
}

function playerRow(name: string): HTMLElement {
  const row = scoreboardRows().find(
    (candidate) => within(candidate).queryByText(name) !== null,
  );
  if (row === undefined) {
    throw new Error(`missing scoreboard row for ${name}`);
  }
  return row;
}

let nextQuestionId = 500;

function mockQuestionsEchoCategory(): void {
  nextQuestionId = 500;
  getQuestion.mockImplementation((category) =>
    Promise.resolve(question({ id: nextQuestionId++, category })),
  );
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
  mode?: "rounds" | "six-categories";
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
    mode = "rounds",
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
  if (mode === "six-categories") {
    await user.selectOptions(
      screen.getByLabelText("Modo de juego"),
      "six-categories",
    );
  } else {
    await user.selectOptions(screen.getByLabelText("Rondas"), rounds);
  }
  await user.click(screen.getByRole("button", { name: "Comenzar" }));
  await screen.findByRole("button", { name: "Girar" });
}

async function spinToResult(user: UserEvent, sectorIndex = 0): Promise<void> {
  vi.mocked(Math.random)
    .mockReturnValueOnce(0)
    .mockReturnValueOnce(0)
    .mockReturnValueOnce((sectorIndex + 0.5) / SIX_CATEGORIES.length)
    .mockReturnValueOnce(0.5);
  await user.click(screen.getByRole("button", { name: "Girar" }));
  await act(async () => {
    queue.drive(FRAME_TIMESTAMPS);
  });
  await screen.findByText(`Salió: ${SIX_CATEGORIES[sectorIndex].label}`);
}

async function spinWheel(user: UserEvent, sectorIndex = 0): Promise<void> {
  await spinToResult(user, sectorIndex);
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

async function continueFromResult(user: UserEvent): Promise<void> {
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
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function fakeClock(): void {
  vi.useFakeTimers({
    shouldAdvanceTime: true,
    toFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "Date",
    ],
  });
  vi.setSystemTime(new Date("2026-10-25T12:00:00Z"));
}

function timerUser(): UserEvent {
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function expectNoTimer(): void {
  expect(screen.queryByRole("timer")).toBeNull();
  expect(screen.queryByRole("progressbar")).toBeNull();
}

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
    await screen.findByRole("heading", { name: "Resultado" });
    expect(screen.getByText("Correcta")).toBeVisible();
  });

  it("accepts a recorded id once and skips it on the next load", async () => {
    const user = userEvent.setup();
    getQuestion.mockResolvedValueOnce(
      question({ id: 7, question: "Pregunta 7" }),
    );
    await startMatch(user);
    await screen.findByText("Pregunta 7");
    await answer(user);
    await continueFromResult(user);

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
    await continueFromResult(user);

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

  it("APPT-10 a correct click reaches Result with the point", async () => {
    const user = userEvent.setup();
    getQuestion.mockResolvedValueOnce(question());
    postAnswer.mockResolvedValueOnce({
      correct: true,
      correct_answer: "Lima",
    });
    await startMatch(user);
    await screen.findByText("¿Capital de Francia?");
    await answer(user);

    await screen.findByRole("heading", { name: "Resultado" });
    expect(screen.getByText("Ana: 10 puntos")).toBeVisible();
    expect(screen.getByText("Correcta")).toBeVisible();
    expect(screen.getByRole("status").textContent).toBe(
      "La respuesta correcta era: Lima",
    );
    expect(screen.queryByText(/Pasale el dispositivo/)).toBeNull();
    expect(screen.getByRole("button", { name: "Reportar" })).toBeDisabled();
    expect(
      screen.queryAllByRole("button", {
        name: /^(Lima|Quito|Bogotá|Buenos Aires)$/,
      }),
    ).toHaveLength(0);
    expect(screen.queryByRole("timer")).toBeNull();
    expect(postAnswer).toHaveBeenCalledTimes(1);
    expect(getQuestion).toHaveBeenCalledTimes(1);

    await continueFromResult(user);

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
    await screen.findByRole("heading", { name: "Resultado" });
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

    await screen.findByRole("heading", { name: "Resultado" });
    expect(screen.getByText("Ana: 0 puntos")).toBeVisible();
    expect(screen.getByText("Incorrecta")).toBeVisible();
    expect(screen.getByText("Elegiste: Lima")).toBeVisible();
    expect(screen.getByRole("status").textContent).toBe(
      "La respuesta correcta era: Lima",
    );
    expect(screen.getByRole("button", { name: "Continuar" })).toBeVisible();
  });

  it("APPT-11 APPT-13 Continue from Result non-final shows the next player without the previous feedback", async () => {
    const user = userEvent.setup();
    getQuestion.mockResolvedValueOnce(
      question({ id: 1, question: "Pregunta 1" }),
    );
    await startMatch(user);
    await screen.findByText("Pregunta 1");
    await answer(user);

    await screen.findByRole("heading", { name: "Resultado" });
    expectNoTimer();
    expect(screen.queryByText(/Pasale el dispositivo/)).toBeNull();
    await continueFromResult(user);

    expect(screen.getByText("Pasale el dispositivo a Beto")).toBeVisible();
    expect(screen.getByText("Ronda 1 de 3")).toBeVisible();
    expect(currentTurnRow()[0]).toHaveTextContent("Beto: 0 puntos");
    expect(screen.queryByText("Correcta")).toBeNull();
    expect(screen.queryByText("Incorrecta")).toBeNull();
    expect(screen.queryByText("Se acabó el tiempo")).toBeNull();
    expect(screen.queryByText(/La respuesta correcta era:/)).toBeNull();
    expect(screen.queryByText(/Elegiste:/)).toBeNull();
    expectNoTimer();

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
    await screen.findByRole("heading", { name: "Resultado" });
    await continueFromResult(user);

    expect(screen.getByText("Pasale el dispositivo a Ana")).toBeVisible();
    expect(screen.getByText("Ronda 2 de 3")).toBeVisible();
  });

  it("APPT-03 APPT-12 APPT-15 APPT-16 a 3-round match reaches GameOver through Result without timers and shows the winner", async () => {
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
        expect(screen.getByText("Ronda 1 de 3")).toBeVisible();
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
      expectNoTimer();
      await continueFromResult(user);
      expectNoTimer();
    }

    expect(screen.getByText("Ganó Ana")).toBeVisible();
    expect(screen.getByText("Ana: 30 puntos")).toBeVisible();
    expect(screen.getByText("Beto: 10 puntos")).toBeVisible();
    expect(screen.queryByText("Turno")).toBeNull();
    expect(document.querySelectorAll(".category-chip")).toHaveLength(0);
    expect(document.body.textContent).not.toMatch(/Categorías: \d+ de 6/);
    expect(document.body.textContent).not.toContain(
      "Límite: 20 turnos por jugador",
    );
    expectNoTimer();
    expect(getCategoriesMock).toHaveBeenCalledTimes(1);
    expect(getQuestion).toHaveBeenCalledTimes(6);
    expect(postAnswer).toHaveBeenCalledTimes(6);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getQuestion).toHaveBeenCalledTimes(6);
    expect(postAnswer).toHaveBeenCalledTimes(6);
  });

  it("returns to the Lobby with defaults from Jugar de nuevo after a rounds match, with no API call", async () => {
    const user = userEvent.setup();

    for (let index = 0; index < 6; index += 1) {
      const id = 400 + index;
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
        correct: false,
        correct_answer: "Lima",
      });
      await answer(user);
      await continueFromResult(user);
    }

    expect(screen.getByText("Empate")).toBeVisible();
    const categoryCalls = getCategoriesMock.mock.calls.length;
    const questionCalls = getQuestion.mock.calls.length;
    const answerCalls = postAnswer.mock.calls.length;

    await user.click(screen.getByRole("button", { name: "Jugar de nuevo" }));

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
    expect(
      (screen.getByLabelText("Modo de juego") as HTMLSelectElement).value,
    ).toBe("rounds");
    expect((screen.getByLabelText("Rondas") as HTMLSelectElement).value).toBe(
      "5",
    );
    expect(screen.queryByText("Empate")).toBeNull();
    expect(screen.queryByRole("button", { name: "Jugar de nuevo" })).toBeNull();
    expect(getCategoriesMock).toHaveBeenCalledTimes(categoryCalls);
    expect(getQuestion).toHaveBeenCalledTimes(questionCalls);
    expect(postAnswer).toHaveBeenCalledTimes(answerCalls);
  });

  it("APPT-17 Continue on the final Result with equal scores shows Empate", async () => {
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
      await screen.findByRole("heading", { name: "Resultado" });
      expectNoTimer();
      await continueFromResult(user);
    }

    expect(screen.getByText("Empate")).toBeVisible();
    expect(screen.getAllByText(/10 puntos/)).toHaveLength(2);
    expect(screen.queryByText(/Ganó/)).toBeNull();
    expectNoTimer();
  });

  it("shows the network message and retries the same category", async () => {
    fakeClock();
    const user = timerUser();
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
    expect(
      screen.getByRole("timer", { name: "Tiempo restante" }),
    ).toHaveTextContent("20 s");
    expect(
      screen.getByRole("progressbar", { name: "Tiempo restante" }),
    ).toHaveAttribute("aria-valuenow", "20");
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
    expectNoTimer();

    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(screen.queryByRole("heading", { name: "Resultado" })).toBeNull();
    expect(screen.queryByText(/La respuesta correcta era:/)).toBeNull();
    expect(screen.queryByText("Ana: 10 puntos")).toBeNull();
    expectNoTimer();
    expect(postAnswer).toHaveBeenCalledTimes(2);
    expect(postAnswer.mock.calls[1]).toEqual([42, "Lima", "es"]);

    retry.resolve({ correct: true, correct_answer: "Lima" });
    await screen.findByRole("heading", { name: "Resultado" });
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

    await screen.findByRole("heading", { name: "Resultado" });
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
    await continueFromResult(user);

    for (const id of [8, 9, 10]) {
      getQuestion.mockResolvedValueOnce(
        question({ id, question: `Pregunta ${id}` }),
      );
      await continueToWheel(user);
      await spinWheel(user);
      await screen.findByText(`Pregunta ${id}`);
      await answer(user);
      await continueFromResult(user);
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
    await continueFromResult(user);

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
    await continueFromResult(user);

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
    await continueFromResult(user);

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
    await continueFromResult(user);

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
    await continueFromResult(user);

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
      await continueFromResult(user);
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

  it("APPT-01 shows no timer while the question loads and starts it when the question arrives", async () => {
    const user = userEvent.setup();
    const pending = deferred<GameQuestion>();
    getQuestion.mockReturnValueOnce(pending.promise);
    await startMatch(user);

    expect(screen.getByRole("status").textContent).toBe("Cargando pregunta...");
    expectNoTimer();

    pending.resolve(question());
    await screen.findByText("¿Capital de Francia?");
    expect(
      screen.getByRole("timer", { name: "Tiempo restante" }).textContent,
    ).toBe("20 s");
  });

  it("APPT-02 an answered question stops the timer and does not time out", async () => {
    fakeClock();
    const user = timerUser();
    const pending = deferred<SubmitAnswerResult>();
    getQuestion.mockResolvedValueOnce(question());
    postAnswer.mockReturnValueOnce(pending.promise);
    await startMatch(user);
    await screen.findByText("¿Capital de Francia?");

    advance(12_000);
    expect(screen.getByRole("timer").textContent).toBe("8 s");

    await answer(user);
    expectNoTimer();

    pending.resolve({ correct: true, correct_answer: "Lima" });
    await screen.findByRole("heading", { name: "Resultado" });
    expectNoTimer();

    advance(20_000);

    expect(postAnswer).toHaveBeenCalledTimes(1);
    expect(postAnswer).toHaveBeenCalledWith(42, "Lima", "es");
    expect(
      postAnswer.mock.calls.filter(([, value]) => value === "(sin respuesta)"),
    ).toHaveLength(0);
  });

  it("APPT-04 a failed submit shows the error screen without a timer and the retry does not restart it", async () => {
    fakeClock();
    const user = timerUser();
    const retry = deferred<SubmitAnswerResult>();
    getQuestion.mockResolvedValueOnce(question());
    postAnswer.mockRejectedValueOnce(networkError());
    postAnswer.mockReturnValueOnce(retry.promise);
    await startMatch(user);
    await screen.findByText("¿Capital de Francia?");

    await answer(user);
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("¿Está corriendo la API?")).toBeVisible();
    expectNoTimer();

    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expectNoTimer();

    advance(30_000);
    expect(postAnswer).toHaveBeenCalledTimes(2);
    expect(postAnswer.mock.calls.map(([, value]) => value)).toEqual([
      "Lima",
      "Lima",
    ]);

    retry.resolve({ correct: true, correct_answer: "Lima" });
    await screen.findByRole("heading", { name: "Resultado" });
    expectNoTimer();
    expect(
      postAnswer.mock.calls.filter(([, value]) => value === "(sin respuesta)"),
    ).toHaveLength(0);
  });

  it("APPT-05 a timeout submits the sentinel and reaches Result", async () => {
    fakeClock();
    const user = timerUser();
    getQuestion.mockResolvedValueOnce(question({ id: 42 }));
    postAnswer.mockResolvedValueOnce({
      correct: false,
      correct_answer: "Buenos Aires",
    });
    await startMatch(user);
    await screen.findByText("¿Capital de Francia?");

    advance(20_000);

    await screen.findByRole("heading", { name: "Resultado" });
    expect(postAnswer).toHaveBeenCalledTimes(1);
    expect(postAnswer).toHaveBeenCalledWith(42, "(sin respuesta)", "es");
    expect(screen.getByText("Se acabó el tiempo")).toBeVisible();
    expect(screen.queryByText(/Elegiste:/)).toBeNull();
    expect(screen.getByRole("status").textContent).toBe(
      "La respuesta correcta era: Buenos Aires",
    );
    expect(screen.getByText("Ana: 0 puntos")).toBeVisible();
    expect(screen.getByText("Beto: 0 puntos")).toBeVisible();
    expectNoTimer();
  });

  it("APPT-06 a timeout is incorrect even when the API reports correct", async () => {
    fakeClock();
    const user = timerUser();
    getQuestion.mockResolvedValueOnce(question());
    postAnswer.mockResolvedValueOnce({
      correct: true,
      correct_answer: "Lima",
    });
    await startMatch(user);
    await screen.findByText("¿Capital de Francia?");

    advance(20_000);

    await screen.findByRole("heading", { name: "Resultado" });
    expect(screen.getByText("Se acabó el tiempo")).toBeVisible();
    expect(screen.queryByText("Correcta")).toBeNull();
    expect(screen.getByText("Ana: 0 puntos")).toBeVisible();
    expect(screen.getByText("Beto: 0 puntos")).toBeVisible();
  });

  it("APPT-07 extra time and a click after zero submit only once", async () => {
    fakeClock();
    const user = timerUser();
    const pending = deferred<SubmitAnswerResult>();
    getQuestion.mockResolvedValueOnce(question());
    postAnswer.mockReturnValueOnce(pending.promise);
    await startMatch(user);
    await screen.findByText("¿Capital de Francia?");

    advance(30_000);

    expect(postAnswer).toHaveBeenCalledTimes(1);
    expect(postAnswer).toHaveBeenCalledWith(42, "(sin respuesta)", "es");

    fireEvent.click(screen.getByRole("button", { name: "Lima" }));
    expect(postAnswer).toHaveBeenCalledTimes(1);

    pending.resolve({ correct: false, correct_answer: "Buenos Aires" });
    await screen.findByRole("heading", { name: "Resultado" });
    expect(screen.getByText("Se acabó el tiempo")).toBeVisible();
    expect(postAnswer).toHaveBeenCalledTimes(1);
  });

  it("APPT-08 a click before zero wins over expiry", async () => {
    fakeClock();
    const user = timerUser();
    getQuestion.mockResolvedValueOnce(question());
    postAnswer.mockResolvedValueOnce({
      correct: false,
      correct_answer: "Buenos Aires",
    });
    await startMatch(user);
    await screen.findByText("¿Capital de Francia?");

    advance(19_000);
    await answer(user, "Lima");
    await screen.findByRole("heading", { name: "Resultado" });

    advance(5_000);

    expect(postAnswer).toHaveBeenCalledTimes(1);
    expect(postAnswer).toHaveBeenCalledWith(42, "Lima", "es");
    expect(
      postAnswer.mock.calls.filter(([, value]) => value === "(sin respuesta)"),
    ).toHaveLength(0);
    expect(screen.getByText("Elegiste: Lima")).toBeVisible();
  });

  it("APPT-09 a failed timeout retries the sentinel and then shows the Result", async () => {
    fakeClock();
    const user = timerUser();
    const retry = deferred<SubmitAnswerResult>();
    getQuestion.mockResolvedValueOnce(question({ id: 42 }));
    postAnswer.mockRejectedValueOnce(networkError());
    postAnswer.mockReturnValueOnce(retry.promise);
    await startMatch(user);
    await screen.findByText("¿Capital de Francia?");

    advance(20_000);
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("¿Está corriendo la API?")).toBeVisible();
    expect(postAnswer).toHaveBeenCalledTimes(1);
    expect(postAnswer.mock.calls[0]).toEqual([42, "(sin respuesta)", "es"]);
    expectNoTimer();

    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(screen.queryByRole("heading", { name: "Resultado" })).toBeNull();
    expect(screen.queryByText("Se acabó el tiempo")).toBeNull();
    expect(screen.getByText("Ana: 0 puntos")).toBeVisible();
    expectNoTimer();
    expect(postAnswer).toHaveBeenCalledTimes(2);
    expect(postAnswer.mock.calls[1]).toEqual([42, "(sin respuesta)", "es"]);

    retry.resolve({ correct: false, correct_answer: "Buenos Aires" });
    await screen.findByRole("heading", { name: "Resultado" });
    expect(screen.getByText("Se acabó el tiempo")).toBeVisible();
    expect(screen.getByText("Ana: 0 puntos")).toBeVisible();
    expectNoTimer();
  });

  it("APPT-18 a background clock jump past zero submits the sentinel once", async () => {
    fakeClock();
    const user = timerUser();
    getQuestion.mockResolvedValueOnce(question({ id: 42 }));
    postAnswer.mockResolvedValueOnce({
      correct: false,
      correct_answer: "Buenos Aires",
    });
    await startMatch(user);
    await screen.findByText("¿Capital de Francia?");
    expect(
      screen.getByRole("timer", { name: "Tiempo restante" }),
    ).toHaveTextContent("20 s");

    const now = Date.now();
    act(() => {
      vi.setSystemTime(now + 60_000);
      vi.advanceTimersByTime(250);
    });

    await screen.findByRole("heading", { name: "Resultado" });
    expect(postAnswer).toHaveBeenCalledTimes(1);
    expect(postAnswer).toHaveBeenCalledWith(42, "(sin respuesta)", "es");
    expect(screen.getByText("Se acabó el tiempo")).toBeVisible();

    advance(250);
    expect(postAnswer).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["10", "10 s", "10"],
    ["30", "30 s", "30"],
  ])(
    "APPT-14 the configured %s seconds drive the timer",
    async (seconds, expectedText, expectedMax) => {
      const user = userEvent.setup();
      getQuestion.mockResolvedValueOnce(question());
      await startToWheel(user, { seconds, rounds: "3" });
      await spinWheel(user);

      await screen.findByText("¿Capital de Francia?");
      expect(screen.getByRole("timer").textContent).toBe(expectedText);
      expect(
        screen.getByRole("progressbar", { name: "Tiempo restante" }),
      ).toHaveAttribute("aria-valuemax", expectedMax);
    },
  );

  it("REG-19 a 10-round match plays 20 answers and never shows the six-mode limit", async () => {
    const user = userEvent.setup();
    for (let index = 0; index < 20; index += 1) {
      getQuestion.mockResolvedValueOnce(
        question({ id: 1000 + index, question: `Pregunta ${index + 1}` }),
      );
      if (index === 0) {
        await startToWheel(user, { rounds: "10" });
      } else {
        await continueToWheel(user);
      }
      await spinWheel(user);
      await screen.findByText(`Pregunta ${index + 1}`);
      postAnswer.mockResolvedValueOnce({
        correct: false,
        correct_answer: "Lima",
      });
      await answer(user);
      await screen.findByRole("heading", { name: "Resultado" });
      await continueFromResult(user);

      if (index === 18) {
        expect(screen.getByText("Ronda 10 de 10")).toBeVisible();
      }
    }

    expect(getQuestion).toHaveBeenCalledTimes(20);
    expect(postAnswer).toHaveBeenCalledTimes(20);
    expect(screen.getByText("Empate")).toBeVisible();
    expect(document.body.textContent).not.toContain(
      "Se alcanzó el límite de 20 turnos.",
    );
    expect(document.body.textContent).not.toMatch(/Categorías: \d+ de 6/);
    expect(document.body.textContent).not.toContain(
      "Límite: 20 turnos por jugador",
    );
  }, 30_000);
});

describe("App six-categories flow with a mocked API", () => {
  async function answerCorrect(): Promise<void> {
    postAnswer.mockResolvedValueOnce({
      correct: true,
      correct_answer: "Lima",
    });
  }

  async function answerWrong(): Promise<void> {
    postAnswer.mockResolvedValueOnce({
      correct: false,
      correct_answer: "Buenos Aires",
    });
  }

  function expectNoRoundLabel(): void {
    expect(document.body.textContent).not.toMatch(/Ronda \d+ de \d+/);
  }

  function expectNoPoints(): void {
    expect(document.body.textContent).not.toMatch(/puntos/i);
    expect(document.body.textContent).not.toMatch(/(Ana|Beto): \d+/);
  }

  it("APS-01 starts in six mode on the Wheel with the six scoreboard and no Ronda", async () => {
    const user = userEvent.setup();
    await startToWheel(user, { mode: "six-categories" });

    expect(
      screen.getByRole("heading", { name: "Girá la ruleta" }),
    ).toBeVisible();
    expect(screen.getByText("Límite: 20 turnos por jugador")).toBeVisible();
    expect(screen.getAllByText("Categorías: 0 de 6")).toHaveLength(2);
    expect(screen.getAllByText("Turnos: 0 de 20")).toHaveLength(2);
    expect(screen.getAllByText("Sin categorías")).toHaveLength(2);
    expectNoRoundLabel();
    expectNoPoints();
    expect(getCategoriesMock).toHaveBeenCalledTimes(1);
    expect(getQuestion).not.toHaveBeenCalled();
  });

  it("APS-02 a correct six-mode answer keeps the turn, does not count a turn and returns to Ana's Wheel", async () => {
    const user = userEvent.setup();
    getQuestion.mockResolvedValueOnce(question({ id: 42 }));
    await answerCorrect();
    await startToWheel(user, { mode: "six-categories" });
    await spinWheel(user);

    await screen.findByText("¿Capital de Francia?");
    await answer(user);

    await screen.findByRole("heading", { name: "Resultado" });
    expect(screen.getByText("Correcta")).toBeVisible();
    expect(screen.getByText("Categorías: 1 de 6")).toBeVisible();
    expect(within(playerRow("Ana")).getByText("Turnos: 0 de 20")).toBeVisible();
    expect(within(playerRow("Ana")).getAllByRole("listitem")).toHaveLength(1);
    const questionCalls = getQuestion.mock.calls.length;

    await continueFromResult(user);

    await screen.findByRole("button", { name: "Girar" });
    expect(screen.queryByText(/Pasale el dispositivo/)).toBeNull();
    expect(currentTurnRow()).toHaveLength(1);
    expect(currentTurnRow()[0]).toHaveTextContent("Ana");
    expect(getQuestion).toHaveBeenCalledTimes(questionCalls);

    getQuestion.mockResolvedValueOnce(question({ id: 43 }));
    await spinToResult(user, 1);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(getQuestion).toHaveBeenCalledTimes(questionCalls + 1);
  });

  it("APS-03 a wrong six-mode answer passes the turn to Beto and counts one turn", async () => {
    const user = userEvent.setup();
    getQuestion.mockResolvedValueOnce(question());
    await answerWrong();
    await startToWheel(user, { mode: "six-categories" });
    await spinWheel(user);

    await screen.findByText("¿Capital de Francia?");
    await answer(user);

    await screen.findByRole("heading", { name: "Resultado" });
    expect(screen.getByText("Incorrecta")).toBeVisible();
    expect(screen.getByText("Elegiste: Lima")).toBeVisible();
    expect(
      within(playerRow("Ana")).getByText("Categorías: 0 de 6"),
    ).toBeVisible();
    expect(screen.getByText("Turnos: 1 de 20")).toBeVisible();

    await continueFromResult(user);

    expect(screen.getByText("Pasale el dispositivo a Beto")).toBeVisible();
    expect(screen.getByText("Límite: 20 turnos por jugador")).toBeVisible();
    expectNoRoundLabel();
    expect(currentTurnRow()).toHaveLength(1);
    expect(currentTurnRow()[0]).toHaveTextContent("Beto");
    expect(getQuestion).toHaveBeenCalledTimes(1);

    await continueFromSwitchTurn(user);
    await screen.findByRole("button", { name: "Girar" });
    expect(currentTurnRow()[0]).toHaveTextContent("Beto");
    expect(getQuestion).toHaveBeenCalledTimes(1);
  });

  it("APS-04 a six-mode timeout ends the turn, counts it once and awards no category", async () => {
    fakeClock();
    const user = timerUser();
    getQuestion.mockResolvedValueOnce(question({ id: 42 }));
    postAnswer.mockResolvedValueOnce({
      correct: true,
      correct_answer: "Lima",
    });
    await startToWheel(user, { mode: "six-categories" });
    await spinWheel(user);
    await screen.findByText("¿Capital de Francia?");

    advance(20_000);

    await screen.findByRole("heading", { name: "Resultado" });
    expect(postAnswer).toHaveBeenCalledTimes(1);
    expect(postAnswer).toHaveBeenCalledWith(42, "(sin respuesta)", "es");
    expect(screen.getByText("Se acabó el tiempo")).toBeVisible();
    expect(screen.queryByText("Correcta")).toBeNull();
    expect(
      within(playerRow("Ana")).getByText("Categorías: 0 de 6"),
    ).toBeVisible();
    expect(within(playerRow("Ana")).getByText("Sin categorías")).toBeVisible();
    expect(screen.getByText("Turnos: 1 de 20")).toBeVisible();

    await continueFromResult(user);
    expect(screen.getByText("Pasale el dispositivo a Beto")).toBeVisible();
  });

  it("APS-05 a correct answer on an owned category requests it and adds no second chip", async () => {
    const user = userEvent.setup();
    getQuestion.mockResolvedValueOnce(question({ id: 42 }));
    await answerCorrect();
    await startToWheel(user, { mode: "six-categories" });
    await spinWheel(user);
    await screen.findByText("¿Capital de Francia?");
    await answer(user);
    await screen.findByRole("heading", { name: "Resultado" });
    await continueFromResult(user);

    getQuestion.mockClear();
    getQuestion.mockResolvedValueOnce(question({ id: 43 }));
    await answerCorrect();
    await spinWheel(user, 0);
    await screen.findByText("¿Capital de Francia?");

    expect(getQuestion.mock.calls[0]).toEqual(["geografia", "es"]);
    for (const [category] of getQuestion.mock.calls) {
      expect(category).toBe("geografia");
    }

    await answer(user);
    await screen.findByRole("heading", { name: "Resultado" });
    expect(within(playerRow("Ana")).getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("Categorías: 1 de 6")).toBeVisible();
    expect(within(playerRow("Ana")).getByText("Turnos: 0 de 20")).toBeVisible();

    await continueFromResult(user);
    await screen.findByRole("button", { name: "Girar" });
    expect(currentTurnRow()[0]).toHaveTextContent("Ana");
  });

  it("APS-06 the sixth category reaches GameOver with the category sentence", async () => {
    const user = userEvent.setup();
    mockQuestionsEchoCategory();

    for (let index = 0; index < 6; index += 1) {
      if (index === 0) {
        await startToWheel(user, { mode: "six-categories" });
      } else {
        await screen.findByRole("button", { name: "Girar" });
      }
      await spinWheel(user, index);
      await screen.findByText("¿Capital de Francia?");
      await answerCorrect();
      await answer(user);
      await screen.findByText("Correcta");
      if (index < 5) {
        await continueFromResult(user);
      }
    }

    expect(screen.getByText("Categorías: 6 de 6")).toBeVisible();
    expect(within(playerRow("Ana")).getByText("Turnos: 0 de 20")).toBeVisible();
    const chips = within(playerRow("Ana")).getAllByRole("listitem");
    expect(chips).toHaveLength(6);
    expect(chips.map((chip) => chip.textContent)).toEqual([
      "Geografía",
      "Historia",
      "Ciencia",
      "Arte",
      "Entretenimiento",
      "Deportes",
    ]);
    const questionCalls = getQuestion.mock.calls.length;
    const answerCalls = postAnswer.mock.calls.length;

    await continueFromResult(user);

    await screen.findByText("Ganó Ana");
    expect(screen.getByText("Juntó las 6 categorías.")).toBeVisible();
    expect(screen.getByText("Límite: 20 turnos por jugador")).toBeVisible();
    expect(screen.getByText("Categorías: 6 de 6")).toBeVisible();
    expect(screen.getByText("Categorías: 0 de 6")).toBeVisible();
    expect(screen.queryByText("Turno")).toBeNull();
    expectNoRoundLabel();
    expectNoPoints();
    expect(getQuestion).toHaveBeenCalledTimes(questionCalls);
    expect(postAnswer).toHaveBeenCalledTimes(answerCalls);
  });

  it("returns to the Lobby with defaults from Jugar de nuevo after a six-mode match, with no API call", async () => {
    const user = userEvent.setup();
    mockQuestionsEchoCategory();

    for (let index = 0; index < 6; index += 1) {
      if (index === 0) {
        await startToWheel(user, { mode: "six-categories" });
      } else {
        await screen.findByRole("button", { name: "Girar" });
      }
      await spinWheel(user, index);
      await screen.findByText("¿Capital de Francia?");
      await answerCorrect();
      await answer(user);
      await screen.findByText("Correcta");
      await continueFromResult(user);
    }

    expect(screen.getByText("Ganó Ana")).toBeVisible();
    const categoryCalls = getCategoriesMock.mock.calls.length;
    const questionCalls = getQuestion.mock.calls.length;
    const answerCalls = postAnswer.mock.calls.length;

    await user.click(screen.getByRole("button", { name: "Jugar de nuevo" }));

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
    expect(
      (screen.getByLabelText("Modo de juego") as HTMLSelectElement).value,
    ).toBe("rounds");
    expect((screen.getByLabelText("Rondas") as HTMLSelectElement).value).toBe(
      "5",
    );
    expect(screen.queryByText("Ganó Ana")).toBeNull();
    expect(screen.queryByRole("button", { name: "Jugar de nuevo" })).toBeNull();
    expect(getCategoriesMock).toHaveBeenCalledTimes(categoryCalls);
    expect(getQuestion).toHaveBeenCalledTimes(questionCalls);
    expect(postAnswer).toHaveBeenCalledTimes(answerCalls);
  });

  it("APS-07 a fifth category keeps the match going", async () => {
    const user = userEvent.setup();
    mockQuestionsEchoCategory();

    for (let index = 0; index < 5; index += 1) {
      if (index === 0) {
        await startToWheel(user, { mode: "six-categories" });
      } else {
        await screen.findByRole("button", { name: "Girar" });
      }
      await spinWheel(user, index);
      await screen.findByText("¿Capital de Francia?");
      await answerCorrect();
      await answer(user);
      await screen.findByText("Correcta");
      await continueFromResult(user);
    }

    await screen.findByRole("button", { name: "Girar" });
    expect(screen.getByText("Categorías: 5 de 6")).toBeVisible();
    expect(within(playerRow("Ana")).getByText("Turnos: 0 de 20")).toBeVisible();
    expect(screen.queryByText("Juntó las 6 categorías.")).toBeNull();
    expect(currentTurnRow()[0]).toHaveTextContent("Ana");
  });

  it("APS-08 the six-mode screens never show a round label", async () => {
    const user = userEvent.setup();
    getQuestion.mockResolvedValueOnce(question());
    await answerWrong();
    await startToWheel(user, { mode: "six-categories" });

    expect(screen.getByText("Límite: 20 turnos por jugador")).toBeVisible();
    expectNoRoundLabel();

    await spinWheel(user);
    await screen.findByText("¿Capital de Francia?");
    expect(screen.getByText("Límite: 20 turnos por jugador")).toBeVisible();
    expectNoRoundLabel();

    await answer(user);
    await screen.findByRole("heading", { name: "Resultado" });
    expect(screen.getByText("Límite: 20 turnos por jugador")).toBeVisible();
    expectNoRoundLabel();

    await continueFromResult(user);
    expect(screen.getByText("Pasale el dispositivo a Beto")).toBeVisible();
    expect(screen.getByText("Límite: 20 turnos por jugador")).toBeVisible();
    expectNoRoundLabel();

    cleanup();
    await startToWheel(user);
    expect(screen.getByText("Ronda 1 de 3")).toBeVisible();
    expect(screen.queryByText("Límite: 20 turnos por jugador")).toBeNull();
  });

  it("APS-09 the six-mode screens never show points", async () => {
    const user = userEvent.setup();
    getQuestion.mockResolvedValueOnce(question());
    await answerWrong();
    await startToWheel(user, { mode: "six-categories" });
    expectNoPoints();

    await spinWheel(user);
    await screen.findByText("¿Capital de Francia?");
    expectNoPoints();

    await answer(user);
    await screen.findByRole("heading", { name: "Resultado" });
    expectNoPoints();

    await continueFromResult(user);
    expect(screen.getByText("Pasale el dispositivo a Beto")).toBeVisible();
    expectNoPoints();

    cleanup();
    getQuestion.mockReset();
    postAnswer.mockReset();
    getQuestion.mockResolvedValueOnce(question());
    postAnswer.mockResolvedValueOnce({
      correct: true,
      correct_answer: "Lima",
    });
    await startMatch(user);
    await screen.findByText("¿Capital de Francia?");
    await answer(user);
    await screen.findByText("Ana: 10 puntos");
  });

  it("APS-10 the App renders chips in acquisition order with their token colours", async () => {
    const user = userEvent.setup();
    mockQuestionsEchoCategory();
    await startToWheel(user, { mode: "six-categories" });

    await spinWheel(user, 0);
    await screen.findByText("¿Capital de Francia?");
    await answerCorrect();
    await answer(user);
    await screen.findByText("Correcta");
    await continueFromResult(user);

    await screen.findByRole("button", { name: "Girar" });
    await spinWheel(user, 2);
    await screen.findByText("¿Capital de Francia?");
    await answerCorrect();
    await answer(user);
    await screen.findByText("Correcta");

    const list = screen.getByRole("list", { name: "Categorías de Ana" });
    const chips = within(list).getAllByRole("listitem");
    expect(chips.map((chip) => chip.textContent)).toEqual([
      "Geografía",
      "Ciencia",
    ]);
    expect(chips[0].style.backgroundColor).toBe(
      "var(--color-category-geografia)",
    );
    expect(chips[1].style.backgroundColor).toBe(
      "var(--color-category-ciencia)",
    );
  });

  it("APS-11 categories stay with their player across the turn change", async () => {
    const user = userEvent.setup();
    getQuestion.mockResolvedValueOnce(question({ id: 1 }));
    await answerCorrect();
    await startToWheel(user, { mode: "six-categories" });
    await spinWheel(user, 0);
    await screen.findByText("¿Capital de Francia?");
    await answer(user);
    await screen.findByText("Correcta");
    await continueFromResult(user);

    getQuestion.mockResolvedValueOnce(
      question({ id: 2, category: "historia" }),
    );
    await answerWrong();
    await spinWheel(user, 1);
    await screen.findByText("¿Capital de Francia?");
    await answer(user);
    await screen.findByText("Incorrecta");
    await continueFromResult(user);
    await continueFromSwitchTurn(user);

    getQuestion.mockResolvedValueOnce(
      question({ id: 3, category: "historia" }),
    );
    await answerCorrect();
    await spinWheel(user, 1);
    await screen.findByText("¿Capital de Francia?");
    await answer(user);
    await screen.findByText("Correcta");

    const anaRow = playerRow("Ana");
    const betoRow = playerRow("Beto");
    expect(within(anaRow).getByText("Geografía")).toBeVisible();
    expect(within(anaRow).queryByText("Historia")).toBeNull();
    expect(within(betoRow).getByText("Historia")).toBeVisible();
    expect(within(betoRow).queryByText("Geografía")).toBeNull();
    expect(within(anaRow).getByText("Categorías: 1 de 6")).toBeVisible();
    expect(within(betoRow).getByText("Categorías: 1 de 6")).toBeVisible();
    expect(within(anaRow).getByText("Turnos: 1 de 20")).toBeVisible();
    expect(within(betoRow).getByText("Turnos: 0 de 20")).toBeVisible();
  });

  it("APS-12 a repeated id is skipped in six mode", async () => {
    const user = userEvent.setup();
    getQuestion.mockResolvedValueOnce(
      question({ id: 7, question: "Pregunta 7" }),
    );
    await answerWrong();
    await startToWheel(user, { mode: "six-categories" });
    await spinWheel(user);
    await screen.findByText("Pregunta 7");
    await answer(user);
    await screen.findByRole("heading", { name: "Resultado" });
    expect(screen.getByText("Turnos: 1 de 20")).toBeVisible();
    await continueFromResult(user);
    await continueFromSwitchTurn(user);

    getQuestion.mockClear();
    for (let index = 0; index < 4; index += 1) {
      getQuestion.mockResolvedValueOnce(question({ id: 7 }));
    }
    getQuestion.mockResolvedValueOnce(
      question({ id: 8, question: "Pregunta 8" }),
    );
    await spinWheel(user);

    await screen.findByText("Pregunta 8");
    expect(getQuestion).toHaveBeenCalledTimes(5);
    expect(screen.getByText("Turnos: 1 de 20")).toBeVisible();
    expect(
      within(playerRow("Beto")).getByText("Categorías: 0 de 6"),
    ).toBeVisible();
    expect(currentTurnRow()[0]).toHaveTextContent("Beto");
  });

  it("APS-13 five repeats in six mode show the deduplication error without changing the match", async () => {
    const user = userEvent.setup();
    getQuestion.mockResolvedValueOnce(
      question({ id: 7, question: "Pregunta 7" }),
    );
    await answerWrong();
    await startToWheel(user, { mode: "six-categories" });
    await spinWheel(user);
    await screen.findByText("Pregunta 7");
    await answer(user);
    await screen.findByRole("heading", { name: "Resultado" });
    await continueFromResult(user);
    await continueFromSwitchTurn(user);

    getQuestion.mockClear();
    getQuestion.mockResolvedValue(question({ id: 7 }));
    await spinWheel(user);

    const alert = await screen.findByRole("alert");
    expect(
      within(alert).getByText("No encontramos una pregunta nueva."),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Volver al lobby" }),
    ).toBeVisible();
    expect(getQuestion).toHaveBeenCalledTimes(5);

    getQuestion.mockReset();
    getQuestion.mockResolvedValueOnce(
      question({ id: 8, question: "Pregunta 8" }),
    );
    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    await screen.findByText("Pregunta 8");
    expect(screen.getByText("Turnos: 1 de 20")).toBeVisible();
    expect(
      within(playerRow("Beto")).getByText("Categorías: 0 de 6"),
    ).toBeVisible();
    expect(currentTurnRow()[0]).toHaveTextContent("Beto");
  });

  it("APS-14 a 404 fallback in six mode serves Historia and adds a Historia chip", async () => {
    const user = userEvent.setup();
    getQuestion.mockRejectedValueOnce(notFound());
    getQuestion.mockResolvedValueOnce(
      question({
        id: 43,
        category: "historia",
        question: "Pregunta de historia",
      }),
    );
    await answerCorrect();
    await startToWheel(user, { mode: "six-categories" });
    await spinWheel(user);

    await screen.findByText("Pregunta de historia");
    expect(getQuestion).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Categoría: Historia")).toBeVisible();
    expect(screen.queryByRole("alert")).toBeNull();

    await answer(user);
    await screen.findByRole("heading", { name: "Resultado" });
    const anaRow = playerRow("Ana");
    expect(within(anaRow).getByText("Historia")).toBeVisible();
    expect(within(anaRow).queryByText("Geografía")).toBeNull();
  });

  it("APS-15 all six 404 in six mode show the all-six message and keep the match", async () => {
    const user = userEvent.setup();
    getQuestion.mockResolvedValueOnce(question());
    await answerWrong();
    await startToWheel(user, { mode: "six-categories" });
    await spinWheel(user);
    await screen.findByText("¿Capital de Francia?");
    await answer(user);
    await screen.findByRole("heading", { name: "Resultado" });
    await continueFromResult(user);
    await continueFromSwitchTurn(user);

    getQuestion.mockClear();
    getQuestion.mockRejectedValue(notFound());
    await spinWheel(user);

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

    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    await screen.findByRole("button", { name: "Girar" });
    expect(getQuestion).toHaveBeenCalledTimes(6);
    expect(within(playerRow("Ana")).getByText("Turnos: 1 de 20")).toBeVisible();

    await spinWheel(user);
    await screen.findByRole("alert");
    expect(getQuestion).toHaveBeenCalledTimes(12);
  });

  it("APS-16 a network error in six mode retries the same category without a turn", async () => {
    const user = userEvent.setup();
    getQuestion.mockRejectedValueOnce(networkError());
    getQuestion.mockResolvedValueOnce(question());
    await startToWheel(user, { mode: "six-categories" });
    await spinWheel(user);

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("¿Está corriendo la API?")).toBeVisible();
    expect(screen.queryByText("Límite: 20 turnos por jugador")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    await screen.findByText("¿Capital de Francia?");
    expect(getQuestion).toHaveBeenCalledTimes(2);
    expect(getQuestion.mock.calls[1]).toEqual(["geografia", "es"]);
    expect(within(playerRow("Ana")).getByText("Turnos: 0 de 20")).toBeVisible();
  });

  it("APS-17 a long correct streak does not count a turn", async () => {
    const user = userEvent.setup();
    mockQuestionsEchoCategory();
    await startToWheel(user, { mode: "six-categories" });

    for (let index = 0; index < 5; index += 1) {
      if (index > 0) {
        await screen.findByRole("button", { name: "Girar" });
      }
      await spinWheel(user, index);
      await screen.findByText("¿Capital de Francia?");
      await answerCorrect();
      await answer(user);
      await screen.findByText("Correcta");
      expect(
        within(playerRow("Ana")).getByText("Turnos: 0 de 20"),
      ).toBeVisible();
      await continueFromResult(user);
    }

    await screen.findByRole("button", { name: "Girar" });
    expect(screen.getByText("Categorías: 5 de 6")).toBeVisible();
    expect(screen.queryByText("Juntó las 6 categorías.")).toBeNull();
    expect(currentTurnRow()[0]).toHaveTextContent("Ana");
  });

  it("APS-18 a correct answer and the failure that ends the streak are one turn", async () => {
    const user = userEvent.setup();
    getQuestion.mockResolvedValueOnce(question({ id: 1 }));
    await answerCorrect();
    await startToWheel(user, { mode: "six-categories" });
    await spinWheel(user);
    await screen.findByText("¿Capital de Francia?");
    await answer(user);
    await screen.findByText("Correcta");
    expect(within(playerRow("Ana")).getByText("Turnos: 0 de 20")).toBeVisible();
    await continueFromResult(user);

    getQuestion.mockResolvedValueOnce(question({ id: 2 }));
    await answerWrong();
    await spinWheel(user, 1);
    await screen.findByText("¿Capital de Francia?");
    await answer(user);
    await screen.findByText("Incorrecta");
    expect(screen.getByText("Turnos: 1 de 20")).toBeVisible();
    expect(screen.getByText("Turnos: 0 de 20")).toBeVisible();

    await continueFromResult(user);
    expect(screen.getByText("Pasale el dispositivo a Beto")).toBeVisible();
  });

  it("APS-19 a served category outside the six settles the answer but adds no chip or turn", async () => {
    const user = userEvent.setup();
    getQuestion.mockResolvedValueOnce(question({ category: "otra" }));
    await answerCorrect();
    await startToWheel(user, { mode: "six-categories" });
    await spinWheel(user);

    await screen.findByText("¿Capital de Francia?");
    await answer(user);
    await screen.findByRole("heading", { name: "Resultado" });

    expect(document.querySelectorAll(".category-chip")).toHaveLength(0);
    expect(
      within(playerRow("Ana")).getByText("Categorías: 0 de 6"),
    ).toBeVisible();
    expect(within(playerRow("Ana")).getByText("Turnos: 0 de 20")).toBeVisible();

    await continueFromResult(user);
    await screen.findByRole("button", { name: "Girar" });
    expect(currentTurnRow()[0]).toHaveTextContent("Ana");
  });
});
