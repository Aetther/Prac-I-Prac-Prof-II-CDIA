import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import type { GameQuestion } from "./api/types";

const fetchMock = vi.fn();

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

async function fillNames(
  user: ReturnType<typeof userEvent.setup>,
): Promise<void> {
  await user.type(screen.getByLabelText("Jugador 1"), "Ana");
  await user.type(screen.getByLabelText("Jugador 2"), "Beto");
  await user.click(screen.getByRole("button", { name: "Comenzar" }));
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("VITE_API_URL", "http://localhost:8000");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(Math, "random").mockReturnValue(0);
  window.history.pushState({}, "", "/");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("App integration through the real API client", () => {
  it("plays lobby, answer and Continue through the real API client", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(question))
      .mockResolvedValueOnce(
        jsonResponse({ correct: true, correct_answer: "Lima" }),
      );

    render(<App />);
    await fillNames(user);

    await screen.findByText("¿Capital de Francia?");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://localhost:8000/game/question?category=geografia&lang=es",
    );

    await user.click(screen.getByRole("button", { name: "Lima" }));
    await screen.findByRole("button", { name: "Opción correcta: Lima" });

    expect(fetchMock.mock.calls[1][0]).toBe(
      "http://localhost:8000/game/answer?lang=es",
    );
    const init = fetchMock.mock.calls[1][1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(init.body).toBe('{"question_id":42,"answer":"Lima"}');

    expect(screen.getByRole("status").textContent).toBe(
      "La respuesta correcta era: Lima",
    );
    expect(screen.getByText("Ana: 10 puntos")).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("Pasale el dispositivo a Beto")).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("turns a rejected fetch into the API message and returns to the Lobby", async () => {
    const user = userEvent.setup();
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    render(<App />);
    await fillNames(user);

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("¿Está corriendo la API?")).toBeVisible();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Volver al lobby" }),
    ).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(1);

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
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("re-rolls across categories using the real 404 ApiError", async () => {
    const user = userEvent.setup();
    fetchMock
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

    render(<App />);
    await fillNames(user);

    await screen.findByText("Pregunta de historia");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://localhost:8000/game/question?category=geografia&lang=es",
    );
    expect(fetchMock.mock.calls[1][0]).toBe(
      "http://localhost:8000/game/question?category=historia&lang=es",
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("rejects a malformed question body without reaching the question screen", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: 42,
        question: "¿Capital de Francia?",
        category: "geografia",
        options: ["solo una"],
        lang: "es",
      }),
    );

    render(<App />);
    await fillNames(user);

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
  });
});
