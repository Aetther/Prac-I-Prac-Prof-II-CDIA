import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserEvent } from "@testing-library/user-event";
import App from "./App";
import { ApiError } from "./api/errors";
import { getCategories, getGameQuestion, submitAnswer } from "./api/game";
import { reportQuestion } from "./api/reports";
import type { GameQuestion } from "./api/types";
import { LANGUAGE_KEY } from "./i18n";
import { chooseLanguage, chooseRounds, lobbyValue } from "./test/lobbyControls";
import { installRafQueue } from "./test/rafQueue";
import type { RafQueue } from "./test/rafQueue";
import { FRAME_TIMESTAMPS, SIX_CATEGORIES } from "./test/wheelFixtures";

vi.mock("./api/game", () => ({
  getCategories: vi.fn(),
  getGameQuestion: vi.fn(),
  submitAnswer: vi.fn(),
}));
vi.mock("./api/reports", () => ({
  reportQuestion: vi.fn(),
}));

const getCategoriesMock = vi.mocked(getCategories);
const getQuestion = vi.mocked(getGameQuestion);
const postAnswer = vi.mocked(submitAnswer);
const reportMock = vi.mocked(reportQuestion);

let queue: RafQueue;
let nextId = 700;

/** Spanish copy that must never reach an English screen. */
const SPANISH_COPY = [
  "Girá la ruleta",
  "Categoría:",
  "Continuar",
  "Reportar",
  "Estoy listo",
  "Jugar de nuevo",
  "puntos",
  "Marcador",
  "Ronda ",
  "Turno",
  "Resultado",
  "Correcta",
  "Incorrecta",
  "Pasale",
  "Sonido",
  "Volumen",
  "Efectos",
  "Música",
  "Elegí",
  "¡",
];

function englishQuestion(): GameQuestion {
  return {
    id: nextId++,
    question: "What is the capital of France?",
    category: "geografia",
    options: ["Lima", "Quito", "Bogotá", "Paris"],
    lang: "en",
  };
}

function expectNoSpanish(screenName: string): void {
  const text = document.querySelector(".app-shell")?.textContent ?? "";
  const labels = [...document.querySelectorAll("[aria-label]")]
    .map((element) => element.getAttribute("aria-label"))
    .join(" ");
  for (const spanish of SPANISH_COPY) {
    expect(`${text} ${labels}`, `${screenName}: ${spanish}`).not.toContain(
      spanish,
    );
  }
}

function shell(): HTMLElement {
  const element = document.querySelector<HTMLElement>(".app-shell");
  if (element === null) throw new Error("no app shell");
  return element;
}

async function startInEnglish(user: UserEvent): Promise<void> {
  render(<App />);
  await chooseLanguage(user, "en");
  await user.type(screen.getByLabelText("Player 1"), "Ana");
  await user.type(screen.getByLabelText("Player 2"), "Beto");
  await chooseRounds(user, "3");
  await user.click(screen.getByRole("button", { name: "PLAY" }));
  await screen.findByRole("button", { name: "Spin" });
}

async function spinToBanner(user: UserEvent): Promise<void> {
  vi.mocked(Math.random)
    .mockReturnValueOnce(0)
    .mockReturnValueOnce(0)
    .mockReturnValueOnce(0.5 / SIX_CATEGORIES.length)
    .mockReturnValueOnce(0.5);
  await user.click(screen.getByRole("button", { name: "Spin" }));
  await act(async () => {
    queue.drive(FRAME_TIMESTAMPS);
  });
  await screen.findByText("Geography!");
}

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  vi.spyOn(Math, "random").mockReturnValue(0);
  queue = installRafQueue();
  window.history.pushState({}, "", "/");
  getCategoriesMock.mockResolvedValue(SIX_CATEGORIES);
  nextId = 700;
  getQuestion.mockImplementation(() => Promise.resolve(englishQuestion()));
  postAnswer.mockResolvedValue({ correct: false, correct_answer: "Paris" });
  reportMock.mockResolvedValue({
    id: 9,
    question_id: 700,
    reason: "traduccion",
    status: "pendiente",
    created_at: "2026-10-30T12:00:00Z",
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("The game in English", () => {
  it("Choosing English switches the Lobby at once", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(shell()).toHaveAttribute("lang", "es");
    await chooseLanguage(user, "en");
    expect(screen.getByLabelText("Player 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Player 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PLAY" })).toBeInTheDocument();
    for (const name of ["Language", "Difficulty", "Game mode", "Rounds"]) {
      expect(screen.getByRole("group", { name })).toBeInTheDocument();
    }
    expect(shell()).toHaveAttribute("lang", "en");
    expectNoSpanish("Lobby");
    await chooseLanguage(user, "es");
    expect(screen.getByLabelText("Jugador 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "JUGAR" })).toBeInTheDocument();
    expect(shell()).toHaveAttribute("lang", "es");
  });

  it("The English wheel names the categories in English", async () => {
    const user = userEvent.setup();
    await startInEnglish(user);
    expect(
      screen.getByRole("img", { name: "Category wheel" }),
    ).toHaveAccessibleDescription(
      "Geography, History, Science, Art, Entertainment, Sports.",
    );
    await spinToBanner(user);
    expect(screen.getByRole("status")).toHaveTextContent("Geography!");
    expect(screen.getByRole("status").textContent).not.toContain("¡");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByText("What is the capital of France?");
    expect(screen.getByText("Category: Geography")).toBeInTheDocument();
    expect(getQuestion).toHaveBeenCalledWith("geografia", "en");
  });

  it("An English match shows no Spanish copy", async () => {
    const user = userEvent.setup();
    await startInEnglish(user);
    expect(
      screen.getByRole("heading", { name: "Spin the wheel!" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Ana's turn!")).toBeInTheDocument();
    expectNoSpanish("Wheel");

    await spinToBanner(user);
    expectNoSpanish("Wheel result");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByText("What is the capital of France?");
    expect(screen.getByText("Pick an answer")).toBeInTheDocument();
    expect(screen.queryByText("Not translated")).toBeNull();
    expectNoSpanish("Question");

    await user.click(screen.getByRole("button", { name: "Quito" }));
    await screen.findByRole("heading", { name: "Result" });
    expect(screen.getByText("Wrong")).toBeInTheDocument();
    expect(
      screen.getByText("The correct answer was: Paris"),
    ).toBeInTheDocument();
    expect(screen.getByText("You chose: Quito")).toBeInTheDocument();
    expectNoSpanish("Result");

    await user.click(screen.getByRole("button", { name: "Report" }));
    const form = await screen.findByRole("region", { name: "Report question" });
    expect(
      within(form).getByRole("radio", { name: "Translation" }),
    ).toBeInTheDocument();
    expect(within(form).getByLabelText("Comment")).toBeInTheDocument();
    expectNoSpanish("Report form");
    await user.click(within(form).getByRole("radio", { name: "Translation" }));
    await user.click(within(form).getByRole("button", { name: "Send report" }));
    await screen.findByText("Thanks, we got your report.");
    expect(reportMock).toHaveBeenCalledWith(
      expect.anything(),
      "traduccion",
      "",
      "en",
    );

    await user.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("button", { name: "I'm ready" });
    expect(screen.getByText("Pass the device")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Beto's turn!" }),
    ).toBeInTheDocument();
    expectNoSpanish("SwitchTurn");

    for (let turn = 1; turn < 6; turn += 1) {
      if (turn > 1) {
        await user.click(
          await screen.findByRole("button", { name: "I'm ready" }),
        );
      } else {
        await user.click(screen.getByRole("button", { name: "I'm ready" }));
      }
      await screen.findByRole("button", { name: "Spin" });
      await spinToBanner(user);
      await user.click(screen.getByRole("button", { name: "Continue" }));
      await screen.findByText("What is the capital of France?");
      await user.click(screen.getByRole("button", { name: "Lima" }));
      await screen.findByRole("heading", { name: "Result" });
      await user.click(screen.getByRole("button", { name: "Continue" }));
    }
    await screen.findByRole("button", { name: "Play again" });
    expect(
      screen.getByRole("heading", { name: "It's a tie!" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Game over")).toBeInTheDocument();
    expectNoSpanish("GameOver");
  }, 30_000);

  it("A network error in English", async () => {
    const user = userEvent.setup();
    getCategoriesMock.mockRejectedValue(
      new ApiError(
        "network",
        "Error de conexión. Verificá que la API esté corriendo.",
        {},
      ),
    );
    render(<App />);
    await chooseLanguage(user, "en");
    await user.type(screen.getByLabelText("Player 1"), "Ana");
    await user.type(screen.getByLabelText("Player 2"), "Beto");
    await user.click(screen.getByRole("button", { name: "PLAY" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Is the API running?");
    expect(
      within(alert).getByRole("button", { name: "Retry" }),
    ).toBeInTheDocument();
    expect(
      within(alert).getByRole("button", { name: "Back to lobby" }),
    ).toBeInTheDocument();
  });

  it("English is remembered after a reload", async () => {
    const user = userEvent.setup();
    const first = render(<App />);
    await chooseLanguage(user, "en");
    expect(localStorage.getItem(LANGUAGE_KEY)).toBe("en");
    first.unmount();
    render(<App />);
    expect(lobbyValue("language")).toBe("en");
    expect(screen.getByRole("button", { name: "PLAY" })).toBeInTheDocument();
  });

  it("An invalid or failing store falls back to Spanish", () => {
    localStorage.setItem(LANGUAGE_KEY, "fr");
    render(<App />);
    expect(lobbyValue("language")).toBe("es");
    expect(screen.getByRole("button", { name: "JUGAR" })).toBeInTheDocument();
  });

  it("Admin ignores the stored language", () => {
    localStorage.setItem(LANGUAGE_KEY, "en");
    window.history.pushState({}, "", "/admin");
    render(<App />);
    expect(
      screen.getByRole("heading", { name: "Administración" }),
    ).toBeInTheDocument();
    expect(document.querySelector('[lang="es"] .admin')).not.toBeNull();
    expect(screen.queryByText("PLAY")).toBeNull();
  });

  it("Spanish stays the default copy", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(lobbyValue("language")).toBe("es");
    expect(
      screen.getByText("Poné a prueba tu conocimiento"),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText("Jugador 1"), "Ana");
    await user.type(screen.getByLabelText("Jugador 2"), "Beto");
    await user.click(screen.getByRole("button", { name: "JUGAR" }));
    await screen.findByRole("heading", { name: "Girá la ruleta" });
    await waitFor(() =>
      expect(screen.getByText("Ana: 0 puntos")).toBeInTheDocument(),
    );
  });
});
