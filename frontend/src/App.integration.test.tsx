import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import type { GameQuestion } from "./api/types";
import { installRafQueue } from "./test/rafQueue";
import type { RafQueue } from "./test/rafQueue";
import { FRAME_TIMESTAMPS, SIX_CATEGORIES } from "./test/wheelFixtures";

const fetchMock = vi.fn();

let queue: RafQueue;

const question: GameQuestion = {
  id: 42,
  question: "¿Capital de Francia?",
  category: "geografia",
  options: ["Lima", "Quito", "Bogotá", "Buenos Aires"],
  lang: "es",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type User = ReturnType<typeof userEvent.setup>;

async function fillNames(user: User): Promise<void> {
  await user.type(screen.getByLabelText("Jugador 1"), "Ana");
  await user.type(screen.getByLabelText("Jugador 2"), "Beto");
}

async function startToWheel(user: User): Promise<void> {
  render(<App />);
  await fillNames(user);
  await user.click(screen.getByRole("button", { name: "Comenzar" }));
  await screen.findByRole("button", { name: "Girar" });
}

async function spinToResult(user: User): Promise<void> {
  await user.click(screen.getByRole("button", { name: "Girar" }));
  await act(async () => {
    queue.drive(FRAME_TIMESTAMPS);
  });
  await screen.findByText("Salió: Geografía");
}

async function spinAndConfirm(user: User): Promise<void> {
  await spinToResult(user);
  await user.click(screen.getByRole("button", { name: "Continuar" }));
}

function requestUrls(): string[] {
  return fetchMock.mock.calls.map(([url]) => String(url));
}

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

function timerUser(): User {
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("VITE_API_URL", "http://localhost:8000");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(Math, "random").mockReturnValue(0);
  queue = installRafQueue();
  window.history.pushState({}, "", "/");
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("App integration through the real API client", () => {
  it("loads categories, spins, loads the question and answers through the real API client", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(SIX_CATEGORIES))
      .mockResolvedValueOnce(jsonResponse(question))
      .mockResolvedValueOnce(
        jsonResponse({ correct: true, correct_answer: "Lima" }),
      );

    await startToWheel(user);

    expect(requestUrls()[0]).toBe("http://localhost:8000/categories");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestUrls().some((url) => url.includes("/game/question"))).toBe(
      false,
    );

    await spinAndConfirm(user);

    await screen.findByText("¿Capital de Francia?");
    expect(requestUrls()[1]).toBe(
      "http://localhost:8000/game/question?category=geografia&lang=es",
    );

    await user.click(screen.getByRole("button", { name: "Lima" }));
    await screen.findByRole("heading", { name: "Resultado" });

    expect(requestUrls()[2]).toBe("http://localhost:8000/game/answer?lang=es");
    const init = fetchMock.mock.calls[2][1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(init.body).toBe('{"question_id":42,"answer":"Lima"}');

    expect(screen.getByRole("status").textContent).toBe(
      "La respuesta correcta era: Lima",
    );
    expect(screen.getByText("Ana: 10 puntos")).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(3);

    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("Pasale el dispositivo a Beto")).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("retries a network error loading labels without touching the question", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(jsonResponse(SIX_CATEGORIES));

    render(<App />);
    await fillNames(user);
    await user.click(screen.getByRole("button", { name: "Comenzar" }));

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("¿Está corriendo la API?")).toBeVisible();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Volver al lobby" }),
    ).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestUrls().some((url) => url.includes("/game/question"))).toBe(
      false,
    );

    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    await screen.findByRole("button", { name: "Girar" });
    expect(requestUrls()[1]).toBe("http://localhost:8000/categories");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestUrls().some((url) => url.includes("/game/question"))).toBe(
      false,
    );
  });

  it("retries a question network error with the same spun category", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(SIX_CATEGORIES))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(jsonResponse(question));

    await startToWheel(user);
    await spinAndConfirm(user);

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("¿Está corriendo la API?")).toBeVisible();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Volver al lobby" }),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    await screen.findByText("¿Capital de Francia?");
    expect(requestUrls()[2]).toBe(
      "http://localhost:8000/game/question?category=geografia&lang=es",
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(
      requestUrls().filter((url) => url.endsWith("/categories")),
    ).toHaveLength(1);
  });

  it("re-rolls across categories using the real 404 ApiError", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(SIX_CATEGORIES))
      .mockResolvedValueOnce(jsonResponse({ detail: "sin preguntas" }, 404))
      .mockResolvedValueOnce(
        jsonResponse({
          id: 43,
          question: "Pregunta de historia",
          category: "historia",
          options: ["A", "B", "C", "D"],
          lang: "es",
        }),
      );

    await startToWheel(user);
    await spinAndConfirm(user);

    await screen.findByText("Pregunta de historia");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(requestUrls()[0]).toBe("http://localhost:8000/categories");
    expect(requestUrls()[1]).toBe(
      "http://localhost:8000/game/question?category=geografia&lang=es",
    );
    expect(requestUrls()[2]).toBe(
      "http://localhost:8000/game/question?category=historia&lang=es",
    );
    expect(screen.getByText("Categoría: Historia")).toBeVisible();
    expect(screen.queryByText("Categoría: Geografía")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("rejects a malformed question body without reaching the question screen", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(SIX_CATEGORIES))
      .mockResolvedValueOnce(
        jsonResponse({
          id: 42,
          question: "¿Capital de Francia?",
          category: "geografia",
          options: ["solo una"],
          lang: "es",
        }),
      );

    await startToWheel(user);
    await spinAndConfirm(user);

    const alert = await screen.findByRole("alert");
    expect(
      within(alert).getByText("Respuesta inválida del servidor."),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Volver al lobby" }),
    ).toBeVisible();
    expect(screen.queryByText("Marcador")).toBeNull();
    expect(screen.queryByText("Elegí una opción")).toBeNull();
    expect(screen.queryByRole("button", { name: "Lima" })).toBeNull();
    expect(screen.queryByText(/Categoría:/)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not fetch a question until the wheel result is confirmed", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(SIX_CATEGORIES))
      .mockResolvedValueOnce(jsonResponse(question));

    await startToWheel(user);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await spinToResult(user);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestUrls().some((url) => url.includes("/game/question"))).toBe(
      false,
    );

    await user.click(screen.getByRole("button", { name: "Continuar" }));

    await screen.findByText("¿Capital de Francia?");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestUrls()[1]).toBe(
      "http://localhost:8000/game/question?category=geografia&lang=es",
    );
  });

  it("returns to the Lobby from a real-client question error without another fetch", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(SIX_CATEGORIES))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await startToWheel(user);
    await spinAndConfirm(user);

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("¿Está corriendo la API?")).toBeVisible();

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
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("INTT-01 the timeout answer posts the sentinel to /game/answer", async () => {
    fakeClock();
    const user = timerUser();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(SIX_CATEGORIES))
      .mockResolvedValueOnce(jsonResponse(question))
      .mockResolvedValueOnce(
        jsonResponse({ correct: false, correct_answer: "Buenos Aires" }),
      );

    await startToWheel(user);
    await spinAndConfirm(user);
    await screen.findByText("¿Capital de Francia?");

    advance(20_000);

    await screen.findByRole("heading", { name: "Resultado" });
    expect(requestUrls()[2]).toBe("http://localhost:8000/game/answer?lang=es");
    const init = fetchMock.mock.calls[2][1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.body).toBe('{"question_id":42,"answer":"(sin respuesta)"}');
    expect(screen.getByText("Se acabó el tiempo")).toBeVisible();
    expect(screen.getByRole("status").textContent).toBe(
      "La respuesta correcta era: Buenos Aires",
    );
    expect(screen.getByText("Ana: 0 puntos")).toBeVisible();
  });

  it("INTT-02 the Result screen makes no fetch", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(SIX_CATEGORIES))
      .mockResolvedValueOnce(jsonResponse(question))
      .mockResolvedValueOnce(
        jsonResponse({ correct: true, correct_answer: "Lima" }),
      );

    await startToWheel(user);
    await spinAndConfirm(user);
    await screen.findByText("¿Capital de Francia?");
    await user.click(screen.getByRole("button", { name: "Lima" }));
    await screen.findByRole("heading", { name: "Resultado" });

    expect(fetchMock).toHaveBeenCalledTimes(3);

    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(screen.getByText("Pasale el dispositivo a Beto")).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("INTT-03 a network error on the timeout retry keeps the sentinel body", async () => {
    fakeClock();
    const user = timerUser();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(SIX_CATEGORIES))
      .mockResolvedValueOnce(jsonResponse(question))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(
        jsonResponse({ correct: false, correct_answer: "Buenos Aires" }),
      );

    await startToWheel(user);
    await spinAndConfirm(user);
    await screen.findByText("¿Capital de Francia?");

    advance(20_000);
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("¿Está corriendo la API?")).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(3);

    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    await screen.findByRole("heading", { name: "Resultado" });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(requestUrls()[2]).toBe("http://localhost:8000/game/answer?lang=es");
    expect(requestUrls()[3]).toBe("http://localhost:8000/game/answer?lang=es");
    expect((fetchMock.mock.calls[2][1] as RequestInit).body).toBe(
      '{"question_id":42,"answer":"(sin respuesta)"}',
    );
    expect((fetchMock.mock.calls[3][1] as RequestInit).body).toBe(
      '{"question_id":42,"answer":"(sin respuesta)"}',
    );
    expect(screen.getByText("Se acabó el tiempo")).toBeVisible();
  });
});
