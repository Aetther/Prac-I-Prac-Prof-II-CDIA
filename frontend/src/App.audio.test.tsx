import { existsSync } from "fs";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserEvent } from "@testing-library/user-event";
import App from "./App";
import { ApiError } from "./api/errors";
import { getCategories, getGameQuestion, submitAnswer } from "./api/game";
import type { GameQuestion } from "./api/types";
import { AUDIO_PREFERENCES_KEY, SOUND_RECIPES } from "./audio";
import type { AudioPreferences, SoundEffect } from "./audio";
import { FakeAudioContext, installFakeAudio } from "./test/fakeAudio";
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
let nextQuestionId = 500;

const SOUND_ON: AudioPreferences = {
  muted: false,
  volume: 60,
  effects: true,
  music: true,
};

function storePreferences(preferences: Partial<AudioPreferences>): void {
  localStorage.setItem(AUDIO_PREFERENCES_KEY, JSON.stringify(preferences));
}

function context(): FakeAudioContext {
  expect(FakeAudioContext.instances).toHaveLength(1);
  return FakeAudioContext.instances[0];
}

/** How many times an effect was played, by the first frequency of its recipe. */
function played(effect: SoundEffect): number {
  const instance = FakeAudioContext.instances[0];
  if (instance === undefined) return 0;
  const first = SOUND_RECIPES[effect].notes[0].frequency;
  const notesPerPlay = SOUND_RECIPES[effect].notes.filter(
    (note) => note.frequency === first,
  ).length;
  return (
    instance.effectFrequencies().filter((frequency) => frequency === first)
      .length / notesPerPlay
  );
}

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

function soundGroup(): HTMLElement {
  return screen.getByRole("region", { name: "Sonido" });
}

async function startToWheel(user: UserEvent): Promise<void> {
  render(<App />);
  await user.type(screen.getByLabelText("Jugador 1"), "Ana");
  await user.type(screen.getByLabelText("Jugador 2"), "Beto");
  await user.selectOptions(screen.getByLabelText("Rondas"), "3");
  await user.click(screen.getByRole("button", { name: "JUGAR" }));
  await screen.findByRole("button", { name: "Girar" });
}

async function spinToResult(user: UserEvent): Promise<void> {
  vi.mocked(Math.random)
    .mockReturnValueOnce(0)
    .mockReturnValueOnce(0)
    .mockReturnValueOnce(0.5 / SIX_CATEGORIES.length)
    .mockReturnValueOnce(0.5);
  await user.click(screen.getByRole("button", { name: "Girar" }));
  await act(async () => {
    queue.drive(FRAME_TIMESTAMPS);
  });
  await screen.findByText(`¡${SIX_CATEGORIES[0].label}!`);
}

async function spinToQuestion(user: UserEvent): Promise<void> {
  await spinToResult(user);
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await screen.findByText(/^¿Capital de Francia\?$/);
}

async function answerToResult(user: UserEvent, option = "Lima"): Promise<void> {
  await user.click(screen.getByRole("button", { name: option }));
  await screen.findByRole("heading", { name: "Resultado" });
}

/** Plays every remaining turn of a 3-round match up to GameOver. */
async function playToGameOver(
  user: UserEvent,
  turnsLeft: number,
): Promise<void> {
  for (let turn = 0; turn < turnsLeft; turn += 1) {
    await spinToQuestion(user);
    await answerToResult(user);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    if (turn < turnsLeft - 1) {
      await user.click(
        await screen.findByRole("button", { name: "Estoy listo" }),
      );
      await screen.findByRole("button", { name: "Girar" });
    }
  }
  await screen.findByRole("heading", { name: /¡Ganó|¡Empate!/ });
}

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  vi.spyOn(Math, "random").mockReturnValue(0);
  queue = installRafQueue();
  window.history.pushState({}, "", "/");
  getCategoriesMock.mockResolvedValue(SIX_CATEGORIES);
  nextQuestionId = 500;
  getQuestion.mockImplementation(() =>
    Promise.resolve(question({ id: nextQuestionId++ })),
  );
  postAnswer.mockResolvedValue({ correct: true, correct_answer: "Lima" });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("App sound controls", () => {
  it("The controls are visible on every game phase", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(soundGroup()).toBeInTheDocument();
    cleanup();
    await startToWheel(user);
    expect(soundGroup()).toBeInTheDocument();
    await spinToQuestion(user);
    expect(soundGroup()).toBeInTheDocument();
    await answerToResult(user);
    expect(soundGroup()).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await screen.findByRole("button", { name: "Estoy listo" });
    expect(soundGroup()).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Estoy listo" }));
    await screen.findByRole("button", { name: "Girar" });
    await spinToQuestion(user);
    await answerToResult(user);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(
      await screen.findByRole("button", { name: "Estoy listo" }),
    );
    await screen.findByRole("button", { name: "Girar" });
    await playToGameOver(user, 4);
    expect(soundGroup()).toBeInTheDocument();
    for (const name of ["Activar sonido", "Efectos", "Música"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("slider", { name: "Volumen" })).toBeInTheDocument();
  });

  it("APP-AUD-01 the error screen keeps the controls", async () => {
    const user = userEvent.setup();
    getCategoriesMock.mockRejectedValue(
      new ApiError(
        "network",
        "Error de conexión. Verificá que la API esté corriendo.",
        {},
      ),
    );
    render(<App />);
    await user.type(screen.getByLabelText("Jugador 1"), "Ana");
    await user.type(screen.getByLabelText("Jugador 2"), "Beto");
    await user.click(screen.getByRole("button", { name: "JUGAR" }));
    await screen.findByRole("alert");
    expect(soundGroup()).toBeInTheDocument();
  });

  it("The mute button names the action it performs", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Activar sonido" }));
    expect(
      screen.getByRole("button", { name: "Silenciar sonido" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Silenciar sonido" }));
    expect(
      screen.getByRole("button", { name: "Activar sonido" }),
    ).toBeInTheDocument();
  });

  it("Admin has no audio", () => {
    installFakeAudio();
    storePreferences(SOUND_ON);
    window.history.pushState({}, "", "/admin");
    render(<App />);
    expect(screen.queryByRole("region", { name: "Sonido" })).toBeNull();
    for (const name of [
      "Activar sonido",
      "Silenciar sonido",
      "Efectos",
      "Música",
    ]) {
      expect(screen.queryByRole("button", { name })).toBeNull();
    }
    expect(screen.queryByRole("slider", { name: "Volumen" })).toBeNull();
    expect(FakeAudioContext.instances).toHaveLength(0);
  });
});

describe("App sounds with a fake AudioContext", () => {
  beforeEach(() => {
    installFakeAudio();
  });

  it("APP-AUD-02 opening the game with sound on creates no context", () => {
    storePreferences(SOUND_ON);
    render(<App />);
    expect(FakeAudioContext.instances).toHaveLength(0);
  });

  it("JUGAR unlocks the audio", async () => {
    storePreferences(SOUND_ON);
    const user = userEvent.setup();
    await startToWheel(user);
    expect(context().resumeCalls).toBeGreaterThanOrEqual(1);
    expect(context().musicBus.gain.target).toBeGreaterThan(0);
  });

  it("The wheel stop plays once", async () => {
    storePreferences(SOUND_ON);
    const user = userEvent.setup();
    await startToWheel(user);
    await spinToResult(user);
    expect(played("spinStop")).toBe(1);
    expect(played("tick")).toBeGreaterThan(0);
  });

  it("Muted plays nothing", async () => {
    storePreferences({ ...SOUND_ON, muted: true });
    const user = userEvent.setup();
    await startToWheel(user);
    await spinToQuestion(user);
    await answerToResult(user);
    expect(context().oscillators).toHaveLength(0);
  });

  it("APP-AUD-03 an answer settles into its outcome sound once", async () => {
    storePreferences(SOUND_ON);
    const user = userEvent.setup();
    postAnswer.mockResolvedValueOnce({
      correct: false,
      correct_answer: "Buenos Aires",
    });
    await startToWheel(user);
    await spinToQuestion(user);
    await answerToResult(user, "Quito");
    await waitFor(() => expect(played("wrong")).toBe(1));
    expect(played("correct")).toBe(0);
    await user.click(screen.getByRole("button", { name: "Silenciar sonido" }));
    await user.click(screen.getByRole("button", { name: "Activar sonido" }));
    expect(played("wrong")).toBe(1);
  });

  it("Effects off keeps the music", async () => {
    storePreferences({ ...SOUND_ON, effects: false });
    const user = userEvent.setup();
    await startToWheel(user);
    await spinToQuestion(user);
    await answerToResult(user);
    expect(context().oscillatorsOn(context().effectsBus)).toHaveLength(0);
    expect(context().musicBus.gain.target).toBeGreaterThan(0);
  });

  it("APP-AUD-04 GameOver plays the fanfare once and stops the music", async () => {
    storePreferences(SOUND_ON);
    const user = userEvent.setup();
    await startToWheel(user);
    await playToGameOver(user, 6);
    await waitFor(() => expect(played("victory")).toBe(1));
    expect(context().musicBus.gain.target).toBe(0);
  });

  it("The music starts with JUGAR and stops in the Lobby", async () => {
    storePreferences(SOUND_ON);
    const user = userEvent.setup();
    await startToWheel(user);
    await playToGameOver(user, 6);
    await user.click(screen.getByRole("button", { name: "Jugar de nuevo" }));
    await screen.findByRole("button", { name: "JUGAR" });
    await waitFor(() => expect(context().musicBus.gain.target).toBe(0));
  });

  it("The last five seconds tick five times", async () => {
    storePreferences(SOUND_ON);
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
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    postAnswer.mockResolvedValueOnce({
      correct: false,
      correct_answer: "Lima",
    });
    await startToWheel(user);
    await spinToQuestion(user);
    act(() => {
      vi.advanceTimersByTime(14_000);
    });
    expect(played("clockTick")).toBe(0);
    act(() => {
      vi.advanceTimersByTime(7_000);
    });
    await screen.findByText("Se acabó el tiempo");
    await waitFor(() => expect(played("timeout")).toBe(1));
    expect(played("clockTick")).toBe(5);
  });

  it("Answering stops the ticking", async () => {
    storePreferences(SOUND_ON);
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
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await startToWheel(user);
    await spinToQuestion(user);
    act(() => {
      vi.advanceTimersByTime(16_000);
    });
    const ticks = played("clockTick");
    expect(ticks).toBeGreaterThanOrEqual(1);
    await answerToResult(user);
    act(() => {
      vi.advanceTimersByTime(6_000);
    });
    expect(played("clockTick")).toBe(ticks);
  });
});

describe("App without Web Audio", () => {
  it("A browser without Web Audio plays silently", async () => {
    vi.stubGlobal("AudioContext", undefined);
    const errors = vi.spyOn(console, "error");
    const user = userEvent.setup();
    await startToWheel(user);
    await user.click(screen.getByRole("button", { name: "Activar sonido" }));
    await user.click(screen.getByRole("button", { name: "Música" }));
    expect(screen.getByRole("button", { name: "Música" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await spinToQuestion(user);
    await answerToResult(user);
    expect(errors).not.toHaveBeenCalled();
  });

  it("The music loads no file", () => {
    expect(existsSync(join(process.cwd(), "public", "audio"))).toBe(false);
  });
});
