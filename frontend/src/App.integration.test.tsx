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
import App from "./App";
import type { GameQuestion, ReportQuestionResult } from "./api/types";
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

function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

type User = ReturnType<typeof userEvent.setup>;

async function fillNames(user: User): Promise<void> {
  await user.type(screen.getByLabelText("Jugador 1"), "Ana");
  await user.type(screen.getByLabelText("Jugador 2"), "Beto");
}

async function startToWheel(
  user: User,
  mode: "rounds" | "six-categories" = "rounds",
): Promise<void> {
  render(<App />);
  await fillNames(user);
  if (mode === "six-categories") {
    await user.selectOptions(screen.getByLabelText("Modo de juego"), mode);
  }
  await user.click(screen.getByRole("button", { name: "JUGAR" }));
  await screen.findByRole("button", { name: "Girar" });
}

async function spinToResult(user: User): Promise<void> {
  await user.click(screen.getByRole("button", { name: "Girar" }));
  await act(async () => {
    queue.drive(FRAME_TIMESTAMPS);
  });
  await screen.findByText("¡Geografía!");
}

async function spinAndConfirm(user: User): Promise<void> {
  await spinToResult(user);
  await user.click(screen.getByRole("button", { name: "Continuar" }));
}

function requestUrls(): string[] {
  return fetchMock.mock.calls.map(([url]) => String(url));
}

function reportCalls(): unknown[][] {
  return fetchMock.mock.calls.filter(([url]) =>
    String(url).endsWith("/reports"),
  );
}

function parsedReportBody(index = 0): unknown {
  const init = reportCalls()[index][1] as RequestInit;
  return JSON.parse(String(init.body));
}

function report201(
  overrides: Partial<ReportQuestionResult> = {},
): ReportQuestionResult {
  return {
    id: 7,
    question_id: 42,
    reason: "traduccion",
    status: "pendiente",
    created_at: "2026-10-26T12:00:00Z",
    ...overrides,
  };
}

async function reachResult(
  user: User,
  served: GameQuestion = question,
): Promise<void> {
  fetchMock
    .mockResolvedValueOnce(jsonResponse(SIX_CATEGORIES))
    .mockResolvedValueOnce(jsonResponse(served))
    .mockResolvedValueOnce(
      jsonResponse({ correct: true, correct_answer: "Lima" }),
    );
  await startToWheel(user);
  await spinAndConfirm(user);
  await screen.findByText(served.question);
  await user.click(screen.getByRole("button", { name: "Lima" }));
  await screen.findByRole("heading", { name: "Resultado" });
}

async function openReportForm(user: User): Promise<void> {
  await user.click(screen.getByRole("button", { name: "Reportar" }));
  await screen.findByRole("region", { name: "Reportar pregunta" });
}

async function fillReport(
  user: User,
  reason:
    | "Traducción"
    | "Respuesta incorrecta"
    | "Error en el texto"
    | "Otro" = "Traducción",
  comment = "",
): Promise<void> {
  await user.click(screen.getByLabelText(reason));
  if (comment !== "") {
    await user.type(screen.getByLabelText("Comentario"), comment);
  }
}

async function submitReport(user: User): Promise<void> {
  await user.click(screen.getByRole("button", { name: "Enviar reporte" }));
}

function reportAlert(): HTMLElement {
  return screen.getByRole("alert");
}

interface MatchSnapshot {
  readonly scores: readonly (string | null)[];
  readonly outcome: string | null;
  readonly currentTurn: string | null;
  readonly round: string | null;
  readonly confirmation: boolean;
  readonly reportedLabel: string | null;
}

function matchSnapshot(): MatchSnapshot {
  return {
    scores: Array.from(document.querySelectorAll(".scoreboard-row")).map(
      (row) => row.textContent,
    ),
    outcome: screen.getByText("Correcta").textContent,
    currentTurn:
      document.querySelector('.scoreboard-row[aria-current="true"]')
        ?.textContent ?? null,
    round: screen.getByText("Ronda 1 de 5").textContent,
    confirmation: screen.queryByText("Gracias. Recibimos tu reporte.") !== null,
    reportedLabel:
      screen.queryByText("Ya reportaste esta pregunta.")?.textContent ?? null,
  };
}

function expectSameMatch(before: MatchSnapshot, after: MatchSnapshot): void {
  expect(after.scores).toEqual(before.scores);
  expect(after.outcome).toBe(before.outcome);
  expect(after.currentTurn).toBe(before.currentTurn);
  expect(after.round).toBe(before.round);
  expect(after.confirmation).toBe(before.confirmation);
  expect(after.reportedLabel).toBe(before.reportedLabel);
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
    expect(screen.getByText("¡Turno de Beto!")).toBeVisible();
    expect(screen.getByText("Pasale el dispositivo")).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("retries a network error loading labels without touching the question", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(jsonResponse(SIX_CATEGORIES));

    render(<App />);
    await fillNames(user);
    await user.click(screen.getByRole("button", { name: "JUGAR" }));

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

    expect(screen.getByRole("heading", { name: "TRIVIA" })).toBeVisible();
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

    expect(screen.getByText("¡Turno de Beto!")).toBeVisible();
    expect(screen.getByText("Pasale el dispositivo")).toBeVisible();
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

  it("INTT-04 six mode requests the spun category and posts the clicked answer", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(SIX_CATEGORIES))
      .mockResolvedValueOnce(jsonResponse(question))
      .mockResolvedValueOnce(
        jsonResponse({ correct: true, correct_answer: "Lima" }),
      );

    await startToWheel(user, "six-categories");

    expect(requestUrls()[0]).toBe("http://localhost:8000/categories");
    expect(fetchMock).toHaveBeenCalledTimes(1);

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
    expect(init.body).toBe('{"question_id":42,"answer":"Lima"}');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(screen.getByText("Correcta")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(
      screen.getByRole("heading", { name: "Girá la ruleta" }),
    ).toBeVisible();
  });

  it("INTT-05 the six-mode timeout posts the sentinel", async () => {
    fakeClock();
    const user = timerUser();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(SIX_CATEGORIES))
      .mockResolvedValueOnce(jsonResponse(question))
      .mockResolvedValueOnce(
        jsonResponse({ correct: false, correct_answer: "Buenos Aires" }),
      );

    await startToWheel(user, "six-categories");
    await spinAndConfirm(user);
    await screen.findByText("¿Capital de Francia?");

    advance(20_000);

    await screen.findByRole("heading", { name: "Resultado" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const init = fetchMock.mock.calls[2][1] as RequestInit;
    expect(init.body).toBe('{"question_id":42,"answer":"(sin respuesta)"}');
    expect(screen.getByText("Se acabó el tiempo")).toBeVisible();
    expect(document.querySelectorAll(".category-chip")).toHaveLength(0);
  });

  it("INTT-06 the six-mode 404 fallback goes to historia", async () => {
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

    await startToWheel(user, "six-categories");
    await spinAndConfirm(user);

    await screen.findByText("Pregunta de historia");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(requestUrls()[1]).toBe(
      "http://localhost:8000/game/question?category=geografia&lang=es",
    );
    expect(requestUrls()[2]).toBe(
      "http://localhost:8000/game/question?category=historia&lang=es",
    );
    expect(screen.getByText("Categoría: Historia")).toBeVisible();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("INTT-07 Continuar after a six-mode correct answer makes no fetch", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(SIX_CATEGORIES))
      .mockResolvedValueOnce(jsonResponse(question))
      .mockResolvedValueOnce(
        jsonResponse({ correct: true, correct_answer: "Lima" }),
      )
      .mockResolvedValueOnce(jsonResponse({ ...question, id: 43 }));

    await startToWheel(user, "six-categories");
    await spinAndConfirm(user);
    await screen.findByText("¿Capital de Francia?");
    await user.click(screen.getByRole("button", { name: "Lima" }));
    await screen.findByRole("heading", { name: "Resultado" });
    expect(fetchMock).toHaveBeenCalledTimes(3);

    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await screen.findByRole("button", { name: "Girar" });
    expect(fetchMock).toHaveBeenCalledTimes(3);

    await spinAndConfirm(user);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(requestUrls()[3]).toBe(
      "http://localhost:8000/game/question?category=geografia&lang=es",
    );
  });
});

describe("App reporting through the real API client", () => {
  const bodyRows: readonly [
    "Traducción" | "Respuesta incorrecta" | "Error en el texto" | "Otro",
    string,
    unknown,
  ][] = [
    ["Traducción", "", { question_id: 42, reason: "traduccion", lang: "es" }],
    [
      "Traducción",
      "  texto  ",
      { question_id: 42, reason: "traduccion", comment: "texto", lang: "es" },
    ],
    [
      "Respuesta incorrecta",
      "",
      { question_id: 42, reason: "respuesta_incorrecta", lang: "es" },
    ],
    [
      "Respuesta incorrecta",
      "  texto  ",
      {
        question_id: 42,
        reason: "respuesta_incorrecta",
        comment: "texto",
        lang: "es",
      },
    ],
    [
      "Error en el texto",
      "",
      { question_id: 42, reason: "error_texto", lang: "es" },
    ],
    [
      "Error en el texto",
      "  texto  ",
      {
        question_id: 42,
        reason: "error_texto",
        comment: "texto",
        lang: "es",
      },
    ],
    [
      "Otro",
      "  Falta la tilde  ",
      {
        question_id: 42,
        reason: "otro",
        comment: "Falta la tilde",
        lang: "es",
      },
    ],
  ];

  it.each(bodyRows)(
    "RIN-01 posts the exact /reports body for %s with comment %j",
    async (reason, comment, expected) => {
      const user = userEvent.setup();
      await reachResult(user);
      fetchMock.mockResolvedValueOnce(jsonResponse(report201(), 201));
      await openReportForm(user);
      await fillReport(user, reason, comment);
      await submitReport(user);
      await screen.findByText("Gracias. Recibimos tu reporte.");

      expect(reportCalls()).toHaveLength(1);
      const [url, init] = reportCalls()[0] as [string, RequestInit];
      expect(url).toBe("http://localhost:8000/reports");
      expect(init.method).toBe("POST");
      expect(init.headers).toEqual({ "Content-Type": "application/json" });
      expect(parsedReportBody()).toStrictEqual(expected);
    },
  );

  it("RIN-02 sends the match lang when the question returned en", async () => {
    const user = userEvent.setup();
    const englishQuestion: GameQuestion = { ...question, lang: "en" };
    fetchMock
      .mockResolvedValueOnce(jsonResponse(SIX_CATEGORIES))
      .mockResolvedValueOnce(jsonResponse(englishQuestion))
      .mockResolvedValueOnce(
        jsonResponse({ correct: true, correct_answer: "Lima" }),
      );
    await startToWheel(user);
    await spinAndConfirm(user);
    await screen.findByText("¿Capital de Francia?");
    expect(screen.getByText("Sin traducir")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Lima" }));
    await screen.findByRole("heading", { name: "Resultado" });

    fetchMock.mockResolvedValueOnce(jsonResponse(report201(), 201));
    await openReportForm(user);
    await fillReport(user, "Traducción");
    await submitReport(user);
    await screen.findByText("Gracias. Recibimos tu reporte.");

    expect(parsedReportBody()).toStrictEqual({
      question_id: 42,
      reason: "traduccion",
      lang: "es",
    });
    expect(JSON.stringify(parsedReportBody())).not.toContain('"en"');
  });

  it("RIN-03 a 201 shows the confirmation and disables the action", async () => {
    const user = userEvent.setup();
    await reachResult(user);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ...report201(), status: "resuelto" }, 201),
    );
    await openReportForm(user);
    await fillReport(user);
    await submitReport(user);

    const confirmation = await screen.findByText(
      "Gracias. Recibimos tu reporte.",
    );
    expect(confirmation).toHaveAttribute("role", "status");
    const report = screen.getByRole("button", { name: "Reportar" });
    expect(report).toBeDisabled();
    expect(report).toHaveAccessibleDescription("Ya reportaste esta pregunta.");
    expect(reportCalls()).toHaveLength(1);
    expect(screen.getByText("Ana: 10 puntos")).toBeVisible();
  });

  it("RIN-04 429 with Retry-After 7 shows the seconds and does not retry by itself", async () => {
    const user = userEvent.setup();
    await reachResult(user);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ detail: "too many" }, 429, { "Retry-After": "7" }),
    );
    await openReportForm(user);
    await fillReport(user, "Otro", "Falta la tilde");
    await submitReport(user);

    expect(within(reportAlert()).getByText("Esperá 7 segundos")).toBeVisible();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeVisible();
    expect(reportCalls()).toHaveLength(1);
    expect(screen.getByText("Correcta")).toBeVisible();
    expect(screen.getByText("Ana: 10 puntos")).toBeVisible();

    await act(async () => {
      await Promise.resolve();
    });
    expect(reportCalls()).toHaveLength(1);

    fetchMock.mockResolvedValueOnce(
      jsonResponse(report201({ reason: "otro" }), 201),
    );
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    await screen.findByText("Gracias. Recibimos tu reporte.");
    expect(reportCalls()).toHaveLength(2);
    expect(parsedReportBody(1)).toStrictEqual(parsedReportBody(0));
  });

  it.each([
    [
      "missing",
      null,
      "Demasiados reportes. Esperá un momento y volvé a intentar.",
    ],
    [
      "abc",
      "abc",
      "Demasiados reportes. Esperá un momento y volvé a intentar.",
    ],
    ["-5", "-5", "Demasiados reportes. Esperá un momento y volvé a intentar."],
    ["1", "1", "Esperá 1 segundo"],
  ])(
    "RIN-05/06/07/22 Retry-After %s uses the right copy",
    async (_label, header, expected) => {
      const user = userEvent.setup();
      await reachResult(user);
      fetchMock.mockResolvedValueOnce(
        jsonResponse(
          { detail: "too many" },
          429,
          header === null ? {} : { "Retry-After": header },
        ),
      );
      await openReportForm(user);
      await fillReport(user);
      await submitReport(user);

      expect(within(reportAlert()).getByText(expected)).toBeVisible();
      expect(screen.getByRole("button", { name: "Reintentar" })).toBeVisible();
      expect(reportCalls()).toHaveLength(1);
      if (header === "-5") {
        expect(screen.queryByText("Esperá -5 segundos")).toBeNull();
      }
      if (header === "1") {
        expect(screen.queryByText("Esperá 1 segundos")).toBeNull();
      }
      await act(async () => {
        await Promise.resolve();
      });
      expect(reportCalls()).toHaveLength(1);
    },
  );

  it("RIN-08 404 shows the unavailable state with no retry and marks nothing", async () => {
    const user = userEvent.setup();
    await reachResult(user);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ detail: "Question not found" }, 404),
    );
    await openReportForm(user);
    await fillReport(user, "Otro", "Falta la tilde");
    await submitReport(user);

    expect(
      within(reportAlert()).getByText("La pregunta ya no está disponible."),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull();
    expect((screen.getByLabelText("Otro") as HTMLInputElement).checked).toBe(
      true,
    );
    expect(
      (screen.getByLabelText("Comentario") as HTMLTextAreaElement).value,
    ).toBe("Falta la tilde");
    expect(
      screen.getByRole("button", { name: "Enviar reporte" }),
    ).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    const report = screen.getByRole("button", { name: "Reportar" });
    expect(report).toBeDisabled();
    expect(report).toHaveAccessibleDescription(
      "La pregunta ya no está disponible.",
    );
    expect(screen.queryByText("Gracias. Recibimos tu reporte.")).toBeNull();
    fireEvent.click(report);
    expect(reportCalls()).toHaveLength(1);
    expect(screen.queryByText("Volver al lobby")).toBeNull();
    expect(screen.getByRole("button", { name: "Continuar" })).toBeEnabled();
  });

  it("RIN-09 a 422 list is editable, offers no retry and resends the edited body", async () => {
    const user = userEvent.setup();
    await reachResult(user);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          detail: [
            {
              loc: ["body", "comment"],
              msg: "<b>comentario</b> requerido",
            },
          ],
        },
        422,
      ),
    );
    await openReportForm(user);
    await fillReport(user, "Otro", "Falta la tilde");
    await submitReport(user);

    expect(
      within(reportAlert()).getByText(
        "El reporte no es válido. Revisá el motivo y el comentario.",
      ),
    ).toBeVisible();
    expect(
      within(reportAlert()).getByText("<b>comentario</b> requerido"),
    ).toBeVisible();
    expect(document.querySelector("b, script")).toBeNull();
    expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Enviar reporte" }),
    ).toBeEnabled();

    await user.clear(screen.getByLabelText("Comentario"));
    await user.type(
      screen.getByLabelText("Comentario"),
      "Falta la tilde corregida",
    );
    expect(screen.queryByRole("alert")).toBeNull();

    fetchMock.mockResolvedValueOnce(
      jsonResponse(report201({ reason: "otro" }), 201),
    );
    await submitReport(user);
    await screen.findByText("Gracias. Recibimos tu reporte.");
    expect(parsedReportBody(1)).toStrictEqual({
      question_id: 42,
      reason: "otro",
      comment: "Falta la tilde corregida",
      lang: "es",
    });
  });

  it("RIN-10 422 text detail is editable without Reintentar", async () => {
    const user = userEvent.setup();
    await reachResult(user);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { detail: "El comentario es obligatorio para el motivo Otro." },
        422,
      ),
    );
    await openReportForm(user);
    await fillReport(user, "Otro", "Falta la tilde");
    await submitReport(user);

    expect(
      within(reportAlert()).getByText(
        "El comentario es obligatorio para el motivo Otro.",
      ),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Enviar reporte" }),
    ).toBeEnabled();
    expect(
      (screen.getByLabelText("Comentario") as HTMLTextAreaElement).value,
    ).toBe("Falta la tilde");
  });

  it("RIN-11 a network failure shows the copy and Retry re-sends the same values", async () => {
    const user = userEvent.setup();
    await reachResult(user);
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await openReportForm(user);
    await fillReport(user, "Otro", "Falta la tilde");
    await submitReport(user);

    expect(
      within(reportAlert()).getByText("¿Está corriendo la API?"),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Continuar" })).toBeEnabled();
    expect(reportCalls()).toHaveLength(1);

    fetchMock.mockResolvedValueOnce(
      jsonResponse(report201({ reason: "otro" }), 201),
    );
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    await screen.findByText("Gracias. Recibimos tu reporte.");
    expect(reportCalls()).toHaveLength(2);
    expect(parsedReportBody(1)).toStrictEqual(parsedReportBody(0));
  });

  it("RIN-12 a timeout shows the same copy and Continuar reaches SwitchTurn", async () => {
    fakeClock();
    const user = timerUser();
    await reachResult(user);
    fetchMock.mockImplementationOnce((_url, init) => {
      return new Promise((_resolve, reject) => {
        const signal = (init as RequestInit).signal;
        signal?.addEventListener("abort", () => {
          const error = new Error("Aborted");
          error.name = "AbortError";
          reject(error);
        });
      });
    });
    await openReportForm(user);
    await fillReport(user);
    await submitReport(user);

    advance(10_000);

    expect(
      within(await screen.findByRole("alert")).getByText(
        "¿Está corriendo la API?",
      ),
    ).toBeVisible();
    expect(screen.getByText("Correcta")).toBeVisible();
    expect(screen.getByText("Ana: 10 puntos")).toBeVisible();
    expect(reportCalls()).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("¡Turno de Beto!")).toBeVisible();
    expect(screen.getByText("Pasale el dispositivo")).toBeVisible();
    expect(reportCalls()).toHaveLength(1);
  });

  it("RIN-13 500 shows Error del servidor. and Retry re-sends", async () => {
    const user = userEvent.setup();
    await reachResult(user);
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: "boom" }, 500));
    await openReportForm(user);
    await fillReport(user);
    await submitReport(user);

    expect(
      within(reportAlert()).getByText("Error del servidor."),
    ).toBeVisible();
    expect(screen.queryByText("boom")).toBeNull();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeVisible();
    expect(reportCalls()).toHaveLength(1);

    fetchMock.mockResolvedValueOnce(jsonResponse(report201(), 201));
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    await screen.findByText("Gracias. Recibimos tu reporte.");
    expect(parsedReportBody(1)).toStrictEqual(parsedReportBody(0));
  });

  it("RIN-14 a malformed 201 is editable, offers no retry and resends", async () => {
    const user = userEvent.setup();
    await reachResult(user);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ...report201(), id: 0 }, 201),
    );
    await openReportForm(user);
    await fillReport(user, "Otro", "Falta la tilde");
    await submitReport(user);

    expect(
      within(reportAlert()).getByText("Respuesta inválida del servidor."),
    ).toBeVisible();
    expect(
      within(reportAlert()).getByText("id de reporte inválido"),
    ).toBeVisible();
    expect(screen.queryByText("Gracias. Recibimos tu reporte.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Enviar reporte" }),
    ).toBeEnabled();

    await user.clear(screen.getByLabelText("Comentario"));
    await user.type(
      screen.getByLabelText("Comentario"),
      "Falta la tilde corregida",
    );
    expect(screen.queryByRole("alert")).toBeNull();

    fetchMock.mockResolvedValueOnce(
      jsonResponse(report201({ reason: "otro" }), 201),
    );
    await submitReport(user);
    await screen.findByText("Gracias. Recibimos tu reporte.");
    expect(parsedReportBody(1)).toStrictEqual({
      question_id: 42,
      reason: "otro",
      comment: "Falta la tilde corregida",
      lang: "es",
    });
  });

  it("RIN-15 Continue before a report reaches SwitchTurn with no report POST", async () => {
    const user = userEvent.setup();
    await reachResult(user);
    expect(reportCalls()).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(screen.getByText("¡Turno de Beto!")).toBeVisible();
    expect(screen.getByText("Pasale el dispositivo")).toBeVisible();
    expect(reportCalls()).toHaveLength(0);
  });

  it("RIN-16 Continue during a pending report reaches SwitchTurn and adds no call", async () => {
    const user = userEvent.setup();
    await reachResult(user);
    let resolveReport!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveReport = resolve;
      }),
    );
    await openReportForm(user);
    await fillReport(user);
    await submitReport(user);

    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("¡Turno de Beto!")).toBeVisible();
    expect(screen.getByText("Pasale el dispositivo")).toBeVisible();
    expect(reportCalls()).toHaveLength(1);

    await act(async () => {
      resolveReport(jsonResponse(report201(), 201));
    });
    expect(screen.getByText("¡Turno de Beto!")).toBeVisible();
    expect(screen.getByText("Pasale el dispositivo")).toBeVisible();
    expect(reportCalls()).toHaveLength(1);
  });

  it("RIN-17 Continue after a failure reaches SwitchTurn with the match intact", async () => {
    const user = userEvent.setup();
    await reachResult(user);
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await openReportForm(user);
    await fillReport(user);
    await submitReport(user);

    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(screen.getByText("¡Turno de Beto!")).toBeVisible();
    expect(screen.getByText("Pasale el dispositivo")).toBeVisible();
    expect(screen.getByText("Ronda 1 de 5")).toBeVisible();
    expect(reportCalls()).toHaveLength(1);
  });

  it("RIN-18 exactly one POST per question with a double click", async () => {
    const user = userEvent.setup();
    await reachResult(user);
    let resolveReport!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveReport = resolve;
      }),
    );
    await openReportForm(user);
    await fillReport(user);

    const submit = screen.getByRole("button", { name: "Enviar reporte" });
    act(() => {
      fireEvent.click(submit);
      fireEvent.click(submit);
    });

    expect(reportCalls()).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "Enviando reporte..." }),
    ).toBeDisabled();

    await act(async () => {
      resolveReport(jsonResponse(report201(), 201));
    });
    await screen.findByText("Gracias. Recibimos tu reporte.");
    expect(reportCalls()).toHaveLength(1);

    const report = screen.getByRole("button", { name: "Reportar" });
    expect(report).toBeDisabled();
    fireEvent.click(report);
    expect(reportCalls()).toHaveLength(1);
  });

  it("RIN-19 the request is exactly POST /reports with only Content-Type", async () => {
    const user = userEvent.setup();
    await reachResult(user);
    fetchMock.mockResolvedValueOnce(jsonResponse(report201(), 201));
    await openReportForm(user);
    await fillReport(user);
    await submitReport(user);
    await screen.findByText("Gracias. Recibimos tu reporte.");

    const [url, init] = reportCalls()[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8000/reports");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.stringify(init.headers)).not.toContain("X-API-Key");
  });

  it.each(["429", "404", "422", "network"] as const)(
    "RIN-20 a %s failure changes no score, outcome, turn, round or reported state",
    async (failure) => {
      const user = userEvent.setup();
      await reachResult(user);
      const before = matchSnapshot();
      expect(before.confirmation).toBe(false);
      expect(before.reportedLabel).toBeNull();

      if (failure === "429") {
        fetchMock.mockResolvedValueOnce(
          jsonResponse({ detail: "too many" }, 429, { "Retry-After": "7" }),
        );
      } else if (failure === "404") {
        fetchMock.mockResolvedValueOnce(
          jsonResponse({ detail: "Question not found" }, 404),
        );
      } else if (failure === "422") {
        fetchMock.mockResolvedValueOnce(
          jsonResponse(
            {
              detail: [
                { loc: ["body", "comment"], msg: "comentario requerido" },
              ],
            },
            422,
          ),
        );
      } else {
        fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
      }

      await openReportForm(user);
      await fillReport(user, "Otro", "Falta la tilde");
      await submitReport(user);
      await screen.findByRole("alert");

      expectSameMatch(before, matchSnapshot());
      expect(reportCalls()).toHaveLength(1);
      expect(screen.queryByText("Gracias. Recibimos tu reporte.")).toBeNull();
      expect(screen.queryByText("Ya reportaste esta pregunta.")).toBeNull();

      await user.click(screen.getByRole("button", { name: "Continuar" }));

      expect(screen.getByText("¡Turno de Beto!")).toBeVisible();
      expect(screen.getByText("Pasale el dispositivo")).toBeVisible();
      expect(reportCalls()).toHaveLength(1);
    },
  );

  it("RIN-20 a timeout changes no score, outcome, turn, round or reported state", async () => {
    fakeClock();
    const user = timerUser();
    await reachResult(user);
    const before = matchSnapshot();
    fetchMock.mockImplementationOnce((_url, init) => {
      return new Promise((_resolve, reject) => {
        const signal = (init as RequestInit).signal;
        signal?.addEventListener("abort", () => {
          const error = new Error("Aborted");
          error.name = "AbortError";
          reject(error);
        });
      });
    });
    await openReportForm(user);
    await fillReport(user, "Otro", "Falta la tilde");
    await submitReport(user);

    advance(10_000);
    await screen.findByRole("alert");

    expectSameMatch(before, matchSnapshot());
    expect(reportCalls()).toHaveLength(1);
    expect(screen.queryByText("Gracias. Recibimos tu reporte.")).toBeNull();
    expect(screen.queryByText("Ya reportaste esta pregunta.")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(screen.getByText("¡Turno de Beto!")).toBeVisible();
    expect(screen.getByText("Pasale el dispositivo")).toBeVisible();
    expect(reportCalls()).toHaveLength(1);
  });

  it("RIN-20 positive control: a 201 changes only the report UI and reported id", async () => {
    const user = userEvent.setup();
    await reachResult(user);
    const before = matchSnapshot();
    fetchMock.mockResolvedValueOnce(jsonResponse(report201(), 201));
    await openReportForm(user);
    await fillReport(user, "Otro", "Falta la tilde");
    await submitReport(user);
    await screen.findByText("Gracias. Recibimos tu reporte.");

    const after = matchSnapshot();
    expect(after.scores).toEqual(before.scores);
    expect(after.outcome).toBe(before.outcome);
    expect(after.currentTurn).toBe(before.currentTurn);
    expect(after.round).toBe(before.round);
    expect(after.confirmation).toBe(true);
    expect(after.reportedLabel).toBe("Ya reportaste esta pregunta.");
    expect(reportCalls()).toHaveLength(1);
  });

  it("RIN-21 showing Result and opening the form make no report call", async () => {
    const user = userEvent.setup();
    await reachResult(user);

    expect(reportCalls()).toHaveLength(0);
    await openReportForm(user);
    expect(reportCalls()).toHaveLength(0);
    expect(
      screen.getByRole("region", { name: "Reportar pregunta" }),
    ).toBeVisible();
  });
});
