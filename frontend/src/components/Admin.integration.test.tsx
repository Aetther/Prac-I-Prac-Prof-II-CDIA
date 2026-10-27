import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AdminReport, ReportStats } from "../api/types";
import { Admin } from "./Admin";

const F_PEN: AdminReport = {
  id: 7,
  question_id: 42,
  reason: "traduccion",
  comment: null,
  lang: "es",
  status: "pendiente",
  created_at: "2026-10-26T12:00:00Z",
  resolved_at: null,
  question: {
    question: "Capital of Peru?",
    answer: "Lima",
    question_es: "¿Capital del Perú?",
    answer_es: "Lima",
    is_translated: true,
    is_active: true,
  },
};

const F_RES: AdminReport = {
  ...F_PEN,
  id: 8,
  question_id: 43,
  reason: "respuesta_incorrecta",
  comment: "Falta la tilde",
  status: "resuelto",
  created_at: "2026-10-26T13:00:00Z",
  resolved_at: "2026-10-27T09:30:00Z",
};

const F_NULL: AdminReport = {
  ...F_PEN,
  id: 10,
  question_id: 45,
  reason: "error_texto",
  created_at: "2026-10-26T15:00:00Z",
  question: {
    question: "Capital of Bolivia?",
    answer: "La Paz",
    question_es: null,
    answer_es: null,
    is_translated: false,
    is_active: false,
  },
};

const F_HTML: AdminReport = {
  ...F_PEN,
  id: 11,
  comment: "<b>Falta</b> la tilde",
  question: {
    ...F_PEN.question,
    question: "<b>Capital</b> of Peru?",
  },
};

const S_MIX: ReportStats = {
  pendiente: 3,
  resuelto: 1,
  descartado: 0,
  pending_by_reason: { otro: 1, traduccion: 2 },
};

const S_AFTER: ReportStats = {
  pendiente: 2,
  resuelto: 2,
  descartado: 0,
  pending_by_reason: {},
};

const S_UNKNOWN: ReportStats = {
  pendiente: 6,
  resuelto: 0,
  descartado: 0,
  pending_by_reason: { duplicada: 2, traduccion: 1, zombi: 3 },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;

function installFetch(handler: Handler) {
  globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
    handler(String(input), init ?? {}),
  ) as unknown as typeof fetch;
}

function fetchMock(): ReturnType<typeof vi.fn> {
  return globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
}

function callsMatching(fragment: string) {
  return fetchMock().mock.calls.filter(([url]) =>
    String(url).includes(fragment),
  );
}

const statsCalls = () => callsMatching("/reports/stats");
const listCalls = () => callsMatching("/reports?");
const patchCalls = () => callsMatching("/reports/7");

async function unlock(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Clave de administración"), "clave");
  await user.click(screen.getByRole("button", { name: "Ingresar" }));
  await screen.findByRole("heading", { name: "Reportes" });
}

beforeEach(() => {
  vi.stubEnv("VITE_API_URL", "http://localhost:8000");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Admin through the real API client", () => {
  it("INT-01 unlock sends exactly GET /reports/stats with the key", async () => {
    const user = userEvent.setup();
    installFetch((url) => {
      if (url.endsWith("/reports/stats")) return jsonResponse(S_MIX);
      if (url.includes("/reports?")) return jsonResponse([F_PEN]);
      throw new Error(`unexpected ${url}`);
    });
    render(<Admin />);
    await unlock(user);

    expect(statsCalls()).toHaveLength(1);
    const [url, init] = statsCalls()[0] as [string, RequestInit];
    expect(String(url)).toBe("http://localhost:8000/reports/stats");
    expect(init.method).toBe("GET");
    expect(init.headers).toEqual({ "X-API-Key": "clave" });
    expect(init.body).toBeUndefined();
    expect(String(url)).not.toContain("clave");
    expect(screen.getByText("Pendientes: 3")).toBeVisible();
    expect(screen.getByText("Resueltos: 1")).toBeVisible();
    expect(screen.getByText("Descartados: 0")).toBeVisible();
  });

  it("INT-02 the first page is GET /reports?status=pendiente&skip=0&limit=20", async () => {
    const user = userEvent.setup();
    installFetch((url) => {
      if (url.endsWith("/reports/stats")) return jsonResponse(S_MIX);
      if (url.includes("/reports?")) return jsonResponse([F_PEN]);
      throw new Error(`unexpected ${url}`);
    });
    render(<Admin />);
    await unlock(user);

    await screen.findByText("Reporte 7");
    expect(listCalls()).toHaveLength(1);
    const [url, init] = listCalls()[0] as [string, RequestInit];
    expect(String(url)).toBe(
      "http://localhost:8000/reports?status=pendiente&skip=0&limit=20",
    );
    expect(init.method).toBe("GET");
    expect(init.headers).toEqual({ "X-API-Key": "clave" });

    const created = document.querySelector("time");
    expect(created).toHaveAttribute("dateTime", "2026-10-26T12:00:00Z");
    expect(created).toHaveTextContent("26/10/26, 9:00 a. m.");
  });

  it("INT-03 the id filter appends question_id last", async () => {
    const user = userEvent.setup();
    installFetch((url) => {
      if (url.endsWith("/reports/stats")) return jsonResponse(S_MIX);
      if (url.includes("/reports?")) return jsonResponse([F_PEN]);
      throw new Error(`unexpected ${url}`);
    });
    render(<Admin />);
    await unlock(user);
    await screen.findByText("Reporte 7");

    const input = screen.getByLabelText("Id de la pregunta");
    await user.type(input, "42");
    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    const withId = listCalls().at(-1) as [string, RequestInit];
    expect(String(withId[0])).toBe(
      "http://localhost:8000/reports?status=pendiente&skip=0&limit=20&question_id=42",
    );

    await user.clear(input);
    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    const withoutId = listCalls().at(-1) as [string, RequestInit];
    expect(String(withoutId[0])).toBe(
      "http://localhost:8000/reports?status=pendiente&skip=0&limit=20",
    );
    expect(String(withoutId[0])).not.toContain("question_id");
  });

  it("INT-04 a status change is exactly PATCH /reports/7 with the status body", async () => {
    const user = userEvent.setup();
    let statsCount = 0;
    let listCount = 0;
    installFetch((url, init) => {
      if (url.endsWith("/reports/stats")) {
        statsCount += 1;
        return jsonResponse(statsCount === 1 ? S_MIX : S_AFTER);
      }
      if (url.includes("/reports?")) {
        listCount += 1;
        return jsonResponse(listCount === 1 ? [F_PEN] : []);
      }
      if (url.endsWith("/reports/7") && init.method === "PATCH") {
        return jsonResponse(F_RES);
      }
      throw new Error(`unexpected ${url}`);
    });
    render(<Admin />);
    await unlock(user);
    await screen.findByText("Reporte 7");

    await user.click(
      screen.getByRole("button", { name: "Marcar resuelto el reporte 7" }),
    );
    await waitFor(() =>
      expect(screen.queryByText("Reporte 7")).not.toBeInTheDocument(),
    );

    expect(patchCalls()).toHaveLength(1);
    const [url, init] = patchCalls()[0] as [string, RequestInit];
    expect(String(url)).toBe("http://localhost:8000/reports/7");
    expect(init.method).toBe("PATCH");
    expect(init.headers).toEqual({
      "X-API-Key": "clave",
      "Content-Type": "application/json",
    });
    expect(String(init.body)).toBe('{"status":"resuelto"}');
    expect(listCalls()).toHaveLength(2);
    expect(statsCalls()).toHaveLength(2);
  });

  it("INT-05 a 401 on the list returns to the gate with the expiry copy", async () => {
    const user = userEvent.setup();
    installFetch((url) => {
      if (url.endsWith("/reports/stats")) return jsonResponse(S_MIX);
      if (url.includes("/reports?")) {
        return jsonResponse({ detail: "Invalid API key" }, 401);
      }
      throw new Error(`unexpected ${url}`);
    });
    render(<Admin />);
    await user.type(screen.getByLabelText("Clave de administración"), "clave");
    await user.click(screen.getByRole("button", { name: "Ingresar" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "La clave dejó de ser válida. Volvé a ingresar la clave.",
      ),
    );
    expect(screen.queryByText("Reporte 7")).not.toBeInTheDocument();
    const listCount = listCalls().length;
    await waitFor(() => expect(listCalls()).toHaveLength(listCount));
  });

  it("INT-06 a 503 shows the server copy and offers a retry that works", async () => {
    const user = userEvent.setup();
    let listCount = 0;
    installFetch((url) => {
      if (url.endsWith("/reports/stats")) return jsonResponse(S_MIX);
      if (url.includes("/reports?")) {
        listCount += 1;
        return listCount === 1
          ? jsonResponse({ detail: "No API_KEY" }, 503)
          : jsonResponse([F_PEN]);
      }
      throw new Error(`unexpected ${url}`);
    });
    render(<Admin />);
    await unlock(user);

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "La API no tiene la clave de administración configurada.",
      ),
    );
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    await screen.findByText("Reporte 7");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(listCalls()).toHaveLength(2);
    expect(String(listCalls()[0][0])).toBe(String(listCalls()[1][0]));
  });

  it("INT-07 a network rejection shows ¿Está corriendo la API?", async () => {
    const user = userEvent.setup();
    installFetch((url) => {
      if (url.endsWith("/reports/stats")) return jsonResponse(S_MIX);
      if (url.includes("/reports?")) {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      throw new Error(`unexpected ${url}`);
    });
    render(<Admin />);
    await unlock(user);

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "¿Está corriendo la API?",
      ),
    );
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeVisible();
    expect(listCalls()).toHaveLength(1);
  });

  it("INT-08 a malformed stats body is a non-retryable validation failure", async () => {
    const user = userEvent.setup();
    let statsCount = 0;
    let listCount = 0;
    installFetch((url) => {
      if (url.endsWith("/reports/stats")) {
        statsCount += 1;
        return statsCount === 1
          ? jsonResponse(S_MIX)
          : jsonResponse({
              pendiente: -1,
              resuelto: 0,
              descartado: 0,
              pending_by_reason: {},
            });
      }
      if (url.includes("/reports?")) {
        listCount += 1;
        return jsonResponse(listCount === 1 ? [F_PEN] : []);
      }
      if (url.endsWith("/reports/7")) return jsonResponse(F_RES);
      throw new Error(`unexpected ${url}`);
    });
    render(<Admin />);
    await unlock(user);
    await screen.findByText("Reporte 7");

    await user.click(
      screen.getByRole("button", { name: "Marcar resuelto el reporte 7" }),
    );

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Respuesta inválida del servidor.",
      ),
    );
    expect(screen.getByText("contador de pendientes inválido")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Reintentar" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Reportes" })).toBeVisible();
  });

  it("INT-09 a report with null comment, null resolution and null Spanish fields renders", async () => {
    const user = userEvent.setup();
    installFetch((url) => {
      if (url.endsWith("/reports/stats")) return jsonResponse(S_MIX);
      if (url.includes("/reports?")) return jsonResponse([F_NULL, F_HTML]);
      throw new Error(`unexpected ${url}`);
    });
    render(<Admin />);
    await unlock(user);
    await screen.findByText("Reporte 10");
    const requestsBeforeToggle = fetchMock().mock.calls.length;

    await user.click(
      screen.getByRole("button", { name: "Abrir la pregunta 45" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Abrir la pregunta 42" }),
    );
    expect(fetchMock().mock.calls).toHaveLength(requestsBeforeToggle);
    expect(statsCalls()).toHaveLength(1);
    expect(listCalls()).toHaveLength(1);

    const nullRegion = screen.getByRole("region", { name: "Pregunta 45" });
    expect(screen.getByText("Comentario: Sin comentario.")).toBeVisible();
    expect(screen.queryByText(/^Resuelto:/)).not.toBeInTheDocument();
    expect(within(nullRegion).getByText("Oculta")).toBeVisible();
    expect(within(nullRegion).getAllByText("Sin traducir")).toHaveLength(3);

    await user.click(
      screen.getByRole("button", { name: "Cerrar la pregunta 42" }),
    );
    expect(fetchMock().mock.calls).toHaveLength(requestsBeforeToggle);
    expect(statsCalls()).toHaveLength(1);
    expect(listCalls()).toHaveLength(1);

    expect(screen.getByText("Comentario: <b>Falta</b> la tilde")).toBeVisible();
    expect(document.querySelector("b")).toBeNull();
  });

  it("INT-10 a stats body with an unknown reason renders it last and does not fail", async () => {
    const user = userEvent.setup();
    installFetch((url) => {
      if (url.endsWith("/reports/stats")) return jsonResponse(S_UNKNOWN);
      if (url.includes("/reports?")) return jsonResponse([F_PEN]);
      throw new Error(`unexpected ${url}`);
    });
    render(<Admin />);
    await unlock(user);

    expect(screen.getByText("Pendientes: 6")).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    const breakdown = within(
      screen.getByRole("list", { name: "Pendientes por motivo" }),
    ).getAllByRole("listitem");
    expect(breakdown.map((item) => item.textContent)).toEqual([
      "Traducción: 1",
      "duplicada: 2",
      "zombi: 3",
    ]);
    expect(statsCalls()).toHaveLength(1);
    expect(listCalls()).toHaveLength(1);
  });
});
