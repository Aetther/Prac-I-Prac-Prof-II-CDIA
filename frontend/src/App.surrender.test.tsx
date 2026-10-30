import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserEvent } from "@testing-library/user-event";
import App from "./App";
import { ApiError } from "./api/errors";
import { getCategories, getGameQuestion, submitAnswer } from "./api/game";
import type { GameQuestion, SubmitAnswerResult } from "./api/types";
import { chooseLanguage, chooseMode, chooseRounds } from "./test/lobbyControls";
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
let nextId = 900;

function question(): GameQuestion {
  return {
    id: nextId++,
    question: "¿Capital de Francia?",
    category: "geografia",
    options: ["Lima", "Quito", "Bogotá", "París"],
    lang: "es",
  };
}

async function startToWheel(
  user: UserEvent,
  options: { mode?: "rounds" | "six-categories"; english?: boolean } = {},
): Promise<void> {
  render(<App />);
  if (options.english) await chooseLanguage(user, "en");
  const [p1, p2, play, spin] = options.english
    ? ["Player 1", "Player 2", "PLAY", "Spin"]
    : ["Jugador 1", "Jugador 2", "JUGAR", "Girar"];
  await user.type(screen.getByLabelText(p1), "Ana");
  await user.type(screen.getByLabelText(p2), "Beto");
  if (options.mode === "six-categories")
    await chooseMode(user, "six-categories");
  else await chooseRounds(user, "3");
  await user.click(screen.getByRole("button", { name: play }));
  await screen.findByRole("button", { name: spin });
}

async function spinToQuestion(user: UserEvent, english = false): Promise<void> {
  vi.mocked(Math.random)
    .mockReturnValueOnce(0)
    .mockReturnValueOnce(0)
    .mockReturnValueOnce(0.5 / SIX_CATEGORIES.length)
    .mockReturnValueOnce(0.5);
  await user.click(
    screen.getByRole("button", { name: english ? "Spin" : "Girar" }),
  );
  await act(async () => {
    queue.drive(FRAME_TIMESTAMPS);
  });
  await user.click(
    await screen.findByRole("button", {
      name: english ? "Continue" : "Continuar",
    }),
  );
  await screen.findByText("¿Capital de Francia?");
}

async function surrender(user: UserEvent, english = false): Promise<void> {
  await user.click(
    screen.getByRole("button", { name: english ? "Surrender" : "Rendirse" }),
  );
  await user.click(
    within(screen.getByRole("alertdialog")).getByRole("button", {
      name: english ? "Yes, I give up" : "Sí, me rindo",
    }),
  );
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

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(Math, "random").mockReturnValue(0);
  queue = installRafQueue();
  window.history.pushState({}, "", "/");
  getCategoriesMock.mockResolvedValue(SIX_CATEGORIES);
  nextId = 900;
  getQuestion.mockImplementation(() => Promise.resolve(question()));
  postAnswer.mockResolvedValue({ correct: true, correct_answer: "París" });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Surrender in the App", () => {
  it("The button is on every in-match screen", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.queryByRole("button", { name: "Rendirse" })).toBeNull();
    cleanup();
    await startToWheel(user);
    expect(screen.getByRole("button", { name: "Rendirse" })).toHaveClass(
      "touch-target",
    );
    await spinToQuestion(user);
    expect(
      screen.getByRole("button", { name: "Rendirse" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "París" }));
    await screen.findByRole("heading", { name: "Resultado" });
    expect(
      screen.getByRole("button", { name: "Rendirse" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await screen.findByRole("button", { name: "Estoy listo" });
    expect(
      screen.getByRole("button", { name: "Rendirse" }),
    ).toBeInTheDocument();
    await surrender(user);
    await screen.findByRole("button", { name: "Jugar de nuevo" });
    expect(screen.queryByRole("button", { name: "Rendirse" })).toBeNull();
  }, 30_000);

  it("SURA-01 the error screen shows no surrender button", async () => {
    const user = userEvent.setup();
    getCategoriesMock.mockRejectedValue(new ApiError("network", "x", {}));
    render(<App />);
    await user.type(screen.getByLabelText("Jugador 1"), "Ana");
    await user.type(screen.getByLabelText("Jugador 2"), "Beto");
    await user.click(screen.getByRole("button", { name: "JUGAR" }));
    await screen.findByRole("alert");
    expect(screen.queryByRole("button", { name: "Rendirse" })).toBeNull();
  });

  it("SURA-02 surrendering on SwitchTurn gives the match to the leader", async () => {
    const user = userEvent.setup();
    await startToWheel(user);
    await spinToQuestion(user);
    await user.click(screen.getByRole("button", { name: "París" }));
    await screen.findByRole("heading", { name: "Resultado" });
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await screen.findByRole("button", { name: "Estoy listo" });
    await user.click(screen.getByRole("button", { name: "Rendirse" }));
    expect(
      screen.getByRole("alertdialog", {
        name: "¿Seguro que querés rendirte, Beto? Gana Ana.",
      }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sí, me rindo" }));
    expect(
      await screen.findByRole("heading", { name: "¡Ganó Ana!" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Beto se rindió.")).toBeInTheDocument();
  });

  it("SURA-03 in six-categories mode the surrender reason replaces the win line", async () => {
    const user = userEvent.setup();
    await startToWheel(user, { mode: "six-categories" });
    await surrender(user);
    expect(
      await screen.findByRole("heading", { name: "¡Ganó Beto!" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Ana se rindió.")).toBeInTheDocument();
    expect(screen.queryByText("Juntó las 6 categorías.")).toBeNull();
    expect(screen.queryByText("Se alcanzó el límite de 20 turnos.")).toBeNull();
  });

  it("The clock keeps running during the confirmation", async () => {
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
    vi.setSystemTime(new Date("2026-10-30T12:00:00Z"));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    postAnswer.mockResolvedValueOnce({
      correct: false,
      correct_answer: "París",
    });
    await startToWheel(user);
    await spinToQuestion(user);
    await user.click(screen.getByRole("button", { name: "Rendirse" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(21_000);
    });
    expect(await screen.findByText("Se acabó el tiempo")).toBeInTheDocument();
    expect(postAnswer).toHaveBeenCalledWith(
      expect.any(Number),
      "(sin respuesta)",
      "es",
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("A late response after surrendering is ignored", async () => {
    const user = userEvent.setup();
    const pending = deferred<SubmitAnswerResult>();
    postAnswer.mockReturnValueOnce(pending.promise);
    await startToWheel(user);
    await spinToQuestion(user);
    await user.click(screen.getByRole("button", { name: "París" }));
    await surrender(user);
    await screen.findByRole("heading", { name: "¡Ganó Beto!" });
    await act(async () => {
      pending.resolve({ correct: true, correct_answer: "París" });
    });
    expect(
      screen.getByRole("heading", { name: "¡Ganó Beto!" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Resultado" })).toBeNull();
  });

  it("SURA-04 a late failure after surrendering shows no error screen", async () => {
    const user = userEvent.setup();
    const pending = deferred<SubmitAnswerResult>();
    postAnswer.mockReturnValueOnce(pending.promise);
    await startToWheel(user);
    await spinToQuestion(user);
    await user.click(screen.getByRole("button", { name: "París" }));
    await surrender(user);
    await screen.findByRole("heading", { name: "¡Ganó Beto!" });
    await act(async () => {
      pending.reject(new ApiError("network", "x", {}));
    });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Jugar de nuevo" }),
    ).toBeInTheDocument();
  });

  it("The surrender reads in English", async () => {
    const user = userEvent.setup();
    await startToWheel(user, { english: true });
    await spinToQuestion(user, true);
    await user.click(screen.getByRole("button", { name: "París" }));
    await screen.findByRole("heading", { name: "Result" });
    await user.click(screen.getByRole("button", { name: "Surrender" }));
    expect(
      screen.getByRole("alertdialog", {
        name: "Are you sure you want to surrender, Ana? Beto wins.",
      }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Yes, I give up" }));
    expect(
      await screen.findByRole("heading", { name: "Beto wins!" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Ana surrendered.")).toBeInTheDocument();
  });
});
