import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getReports, getReportStats, updateReportStatus } from "../api/admin";
import { ApiError } from "../api/errors";
import type { AdminReport, ReportStats } from "../api/types";
import { Admin } from "./Admin";

vi.mock("../api/admin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/admin")>();
  return {
    ...actual,
    getReportStats: vi.fn(),
    getReports: vi.fn(),
    updateReportStatus: vi.fn(),
  };
});

const getReportStatsMock = vi.mocked(getReportStats);
const getReportsMock = vi.mocked(getReports);
const updateReportStatusMock = vi.mocked(updateReportStatus);

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

const F_DES: AdminReport = {
  ...F_PEN,
  id: 9,
  question_id: 44,
  reason: "otro",
  lang: "en",
  status: "descartado",
  created_at: "2026-10-26T14:00:00Z",
  resolved_at: "2026-10-27T10:00:00Z",
  question: {
    question: "Capital of Ecuador?",
    answer: "Quito",
    question_es: null,
    answer_es: null,
    is_translated: false,
    is_active: true,
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

function page(count: number): AdminReport[] {
  return Array.from({ length: count }, (_, index) => {
    const id = index + 1;
    return {
      ...F_PEN,
      id,
      question_id: id === 7 ? 42 : 100 + id,
    };
  });
}

const PAGE_20 = page(20);
const PAGE_19 = PAGE_20.filter((report) => report.id !== 7);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
let consoleLogSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  getReportStatsMock.mockReset().mockResolvedValue(S_MIX);
  getReportsMock.mockReset().mockResolvedValue(PAGE_20);
  updateReportStatusMock.mockReset().mockResolvedValue(F_RES);
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
  consoleLogSpy.mockRestore();
  vi.unstubAllGlobals();
});

async function unlock(user: ReturnType<typeof userEvent.setup>, key = "clave") {
  await user.type(screen.getByLabelText("Clave de administración"), key);
  await user.click(screen.getByRole("button", { name: "Ingresar" }));
  await screen.findByRole("heading", { name: "Reportes" });
}

async function unlockToPage(
  user: ReturnType<typeof userEvent.setup>,
  key = "clave",
) {
  await unlock(user, key);
  await screen.findByText("Reporte 7");
}

function keyInput(): HTMLInputElement {
  return screen.getByLabelText("Clave de administración") as HTMLInputElement;
}

describe("Admin session", () => {
  it("AUTH-08 mount shows the gate and makes no request", () => {
    render(<Admin />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Administración" }),
    ).toBeVisible();
    expect(keyInput()).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Ingresar" })).toBeDisabled();
    expect(
      screen.queryByRole("heading", { name: "Reportes" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/^Pendientes:/)).not.toBeInTheDocument();
    expect(getReportStatsMock).not.toHaveBeenCalled();
    expect(getReportsMock).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(keyInput());
  });

  it("AUTH-09 a valid key unlocks, shows the counters and requests the first page", async () => {
    const user = userEvent.setup();
    render(<Admin />);

    await unlock(user);

    expect(getReportStatsMock).toHaveBeenCalledTimes(1);
    expect(getReportStatsMock).toHaveBeenCalledWith("clave");
    expect(getReportsMock).toHaveBeenCalledTimes(1);
    expect(getReportsMock).toHaveBeenCalledWith("clave", {
      status: "pendiente",
      questionId: null,
      skip: 0,
      limit: 20,
    });
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("heading", { name: "Reportes" }),
      ),
    );
    expect(screen.getByText("Pendientes: 3")).toBeVisible();
    expect(screen.getByText("Resueltos: 1")).toBeVisible();
    expect(screen.getByText("Descartados: 0")).toBeVisible();
    expect(
      screen.queryByLabelText("Clave de administración"),
    ).not.toBeInTheDocument();
  });

  it("AUTH-10 an entry 401 keeps the gate, the typed value and makes no list request", async () => {
    const user = userEvent.setup();
    getReportStatsMock
      .mockReset()
      .mockRejectedValue(
        new ApiError("http", "Error en la solicitud.", { status: 401 }),
      );
    render(<Admin />);

    await user.type(keyInput(), "mala");
    await user.click(screen.getByRole("button", { name: "Ingresar" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "La clave no es válida.",
      ),
    );
    expect(keyInput().value).toBe("mala");
    await waitFor(() => expect(document.activeElement).toBe(keyInput()));
    expect(
      screen.queryByRole("heading", { name: "Reportes" }),
    ).not.toBeInTheDocument();
    expect(getReportsMock).not.toHaveBeenCalled();
  });

  it("AUTH-11 a 503 at entry shows the server-configuration copy", async () => {
    const user = userEvent.setup();
    getReportStatsMock
      .mockReset()
      .mockRejectedValue(
        new ApiError("http", "Error del servidor.", { status: 503 }),
      );
    render(<Admin />);

    await user.type(keyInput(), "clave");
    await user.click(screen.getByRole("button", { name: "Ingresar" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "La API no tiene la clave de administración configurada.",
      ),
    );
    expect(
      screen.queryByText("La clave no es válida."),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ingresar" })).toBeEnabled();
    expect(getReportsMock).not.toHaveBeenCalled();
  });

  it("AUTH-12 a network or timeout at entry stays on the gate with the typed value", async () => {
    const user = userEvent.setup();

    for (const kind of ["network", "timeout"] as const) {
      getReportStatsMock
        .mockReset()
        .mockRejectedValue(new ApiError(kind, "Sin conexión."));
      const view = render(<Admin />);

      await user.type(keyInput(), "clave");
      await user.click(screen.getByRole("button", { name: "Ingresar" }));

      await waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent(
          "¿Está corriendo la API?",
        ),
      );
      expect(screen.getByRole("button", { name: "Ingresar" })).toBeEnabled();
      expect(keyInput().value).toBe("clave");
      expect(getReportsMock).not.toHaveBeenCalled();
      view.unmount();
    }
  });

  it("F3 verifying disables the gate controls while the stats request is pending", async () => {
    const user = userEvent.setup();
    const pendingStats = deferred<ReportStats>();
    getReportStatsMock.mockReset().mockReturnValueOnce(pendingStats.promise);
    render(<Admin />);

    await user.type(keyInput(), "clave");
    await user.click(screen.getByRole("button", { name: "Ingresar" }));

    const input = keyInput();
    expect(input).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Verificando..." }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Ingresar" }),
    ).not.toBeInTheDocument();
    expect(getReportsMock).not.toHaveBeenCalled();

    pendingStats.resolve(S_MIX);
    await screen.findByRole("heading", { name: "Reportes" });
    await screen.findByText("Reporte 7");
    expect(screen.getByText("Pendientes: 3")).toBeVisible();
    expect(
      screen.queryByLabelText("Clave de administración"),
    ).not.toBeInTheDocument();
  });

  it("AUTH-13 a 401 on the list returns to the gate with the expiry copy and clears everything", async () => {
    const user = userEvent.setup();
    render(<Admin />);
    await unlockToPage(user);
    await user.click(
      screen.getByRole("button", { name: "Abrir la pregunta 42" }),
    );
    expect(screen.getByRole("region", { name: "Pregunta 42" })).toBeVisible();

    getReportsMock
      .mockReset()
      .mockRejectedValue(
        new ApiError("http", "Error en la solicitud.", { status: 401 }),
      );
    await user.selectOptions(screen.getByLabelText("Estado"), "descartado");
    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "La clave dejó de ser válida. Volvé a ingresar la clave.",
      ),
    );
    expect(keyInput().value).toBe("");
    await waitFor(() => expect(document.activeElement).toBe(keyInput()));
    expect(screen.queryByText(/^Pendientes:/)).not.toBeInTheDocument();
    expect(screen.queryByText("Reporte 7")).not.toBeInTheDocument();
    expect(screen.queryByText("Estado actualizado.")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Pregunta 42" }),
    ).not.toBeInTheDocument();

    await flush();
    expect(getReportStatsMock).toHaveBeenCalledTimes(1);
    expect(getReportsMock).toHaveBeenCalledTimes(1);
  });

  it("AUTH-14 a 401 on a stats refresh and on a PATCH each return to the gate", async () => {
    const user = userEvent.setup();

    const statsCase = render(<Admin />);
    await unlockToPage(user);
    getReportStatsMock
      .mockReset()
      .mockRejectedValueOnce(
        new ApiError("http", "Error en la solicitud.", { status: 401 }),
      );
    getReportsMock.mockReset().mockResolvedValue(PAGE_19);
    await user.click(
      screen.getByRole("button", { name: "Marcar resuelto el reporte 7" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "La clave dejó de ser válida. Volvé a ingresar la clave.",
      ),
    );
    expect(keyInput().value).toBe("");
    statsCase.unmount();

    getReportStatsMock.mockReset().mockResolvedValue(S_MIX);
    getReportsMock.mockReset().mockResolvedValue(PAGE_20);
    updateReportStatusMock
      .mockReset()
      .mockRejectedValue(
        new ApiError("http", "Error en la solicitud.", { status: 401 }),
      );
    render(<Admin />);
    await unlockToPage(user);
    await user.click(
      screen.getByRole("button", { name: "Marcar resuelto el reporte 7" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "La clave dejó de ser válida. Volvé a ingresar la clave.",
      ),
    );
    expect(keyInput().value).toBe("");
    expect(screen.queryByText("Reporte 7")).not.toBeInTheDocument();
  });

  it("AUTH-15 Salir clears the key and every panel datum and makes no request", async () => {
    const user = userEvent.setup();
    render(<Admin />);
    await unlockToPage(user);
    await user.selectOptions(screen.getByLabelText("Estado"), "descartado");
    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await screen.findByText("Reporte 7");
    await user.click(
      screen.getByRole("button", { name: "Abrir la pregunta 42" }),
    );
    expect(screen.getByRole("region", { name: "Pregunta 42" })).toBeVisible();

    const statsCalls = getReportStatsMock.mock.calls.length;
    const listCalls = getReportsMock.mock.calls.length;
    await user.click(screen.getByRole("button", { name: "Salir" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(keyInput().value).toBe("");
    await waitFor(() => expect(document.activeElement).toBe(keyInput()));
    expect(screen.queryByText(/^Pendientes:/)).not.toBeInTheDocument();
    expect(screen.queryByText("Reporte 7")).not.toBeInTheDocument();
    expect(screen.queryByText("Estado actualizado.")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Pregunta 42" }),
    ).not.toBeInTheDocument();
    expect(getReportStatsMock).toHaveBeenCalledTimes(statsCalls);
    expect(getReportsMock).toHaveBeenCalledTimes(listCalls);

    await user.type(keyInput(), "clave2");
    await user.click(screen.getByRole("button", { name: "Ingresar" }));
    await screen.findByRole("heading", { name: "Reportes" });

    const statsOrder = getReportStatsMock.mock.invocationCallOrder[1];
    const listOrder = getReportsMock.mock.invocationCallOrder[listCalls];
    expect(statsOrder).toBeLessThan(listOrder);
    expect(getReportStatsMock).toHaveBeenLastCalledWith("clave2");
  });

  it("AUTH-16 a late 401 from a previous session does not clear a new key", async () => {
    const user = userEvent.setup();
    const pendingList = deferred<AdminReport[]>();
    getReportsMock
      .mockReset()
      .mockReturnValueOnce(pendingList.promise)
      .mockResolvedValueOnce(PAGE_20);
    const view = render(<Admin />);
    await unlock(user, "claveA");

    await user.click(screen.getByRole("button", { name: "Salir" }));
    await unlock(user, "claveB");
    await view.findByText("Reporte 7");

    pendingList.reject(
      new ApiError("http", "Error en la solicitud.", { status: 401 }),
    );
    await flush();

    expect(screen.getByRole("heading", { name: "Reportes" })).toBeVisible();
    expect(
      screen.queryByLabelText("Clave de administración"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "La clave dejó de ser válida. Volvé a ingresar la clave.",
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Pendientes: 3")).toBeVisible();
  });

  it("AUTH-17 a remount loses the key and nothing was stored, titled or logged", async () => {
    const user = userEvent.setup();
    const secret = "clave-secreta-123";
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    const cookieSpy = vi.spyOn(Document.prototype, "cookie", "set");
    const view = render(<Admin />);
    await unlockToPage(user, secret);
    expect(screen.getByRole("heading", { name: "Reportes" })).toBeVisible();
    const statsCalls = getReportStatsMock.mock.calls.length;
    const listCalls = getReportsMock.mock.calls.length;
    view.unmount();

    render(<Admin />);

    expect(keyInput()).toBeVisible();
    expect(getReportStatsMock).toHaveBeenCalledTimes(statsCalls);
    expect(getReportsMock).toHaveBeenCalledTimes(listCalls);

    for (const call of setItemSpy.mock.calls) {
      expect(JSON.stringify(call)).not.toContain(secret);
    }
    expect(cookieSpy).not.toHaveBeenCalled();
    expect(document.cookie).toBe("");
    expect(document.title).not.toContain(secret);
    expect(window.location.href).not.toContain(secret);
    expect(document.body.textContent ?? "").not.toContain(secret);
    for (const spy of [consoleErrorSpy, consoleLogSpy]) {
      expect(JSON.stringify(spy.mock.calls)).not.toContain(secret);
      expect(JSON.stringify(spy.mock.calls)).not.toContain("X-API-Key");
    }

    setItemSpy.mockRestore();
    cookieSpy.mockRestore();
  });

  it("AUTH-18 the admin view constructs no AudioContext and renders no audio control", async () => {
    const user = userEvent.setup();
    const audioSpy = vi.fn();
    vi.stubGlobal("AudioContext", audioSpy);
    new (audioSpy as unknown as new () => unknown)();
    expect(audioSpy).toHaveBeenCalledTimes(1);
    audioSpy.mockClear();

    const { container } = render(<Admin />);
    await unlockToPage(user);
    await user.click(
      screen.getByRole("button", { name: "Marcar resuelto el reporte 7" }),
    );
    await flush();
    await user.click(
      screen.getByRole("button", { name: "Abrir la pregunta 42" }),
    );

    expect(audioSpy).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: /música|sonido|volumen/i }),
    ).not.toBeInTheDocument();
    expect(container.querySelector("audio")).toBeNull();
  });
});

describe("Admin stats", () => {
  it("STATS-03 a status change refreshes the counters and a failed refresh keeps them", async () => {
    const user = userEvent.setup();
    getReportStatsMock
      .mockReset()
      .mockResolvedValueOnce(S_MIX)
      .mockResolvedValueOnce(S_AFTER);
    getReportsMock
      .mockReset()
      .mockResolvedValueOnce(PAGE_20)
      .mockResolvedValueOnce(PAGE_19);
    const first = render(<Admin />);
    await unlockToPage(user);
    await user.click(
      screen.getByRole("button", { name: "Marcar resuelto el reporte 7" }),
    );
    await waitFor(() =>
      expect(screen.getByText("Pendientes: 2")).toBeVisible(),
    );
    expect(getReportStatsMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Resueltos: 2")).toBeVisible();
    first.unmount();

    getReportStatsMock
      .mockReset()
      .mockResolvedValueOnce(S_MIX)
      .mockRejectedValueOnce(new ApiError("network", "Sin conexión."));
    getReportsMock.mockReset().mockResolvedValue(PAGE_20);
    render(<Admin />);
    await unlockToPage(user);
    await user.click(
      screen.getByRole("button", { name: "Marcar resuelto el reporte 7" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "¿Está corriendo la API?",
      ),
    );
    expect(screen.getByText("Pendientes: 3")).toBeVisible();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeVisible();
  });
});

describe("Admin list", () => {
  it("LIST-08 applying a status filter from page 2 requests skip 0", async () => {
    const user = userEvent.setup();
    render(<Admin />);
    await unlockToPage(user);

    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(getReportsMock).toHaveBeenLastCalledWith("clave", {
      status: "pendiente",
      questionId: null,
      skip: 20,
      limit: 20,
    });

    await user.selectOptions(screen.getByLabelText("Estado"), "descartado");
    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    expect(getReportsMock).toHaveBeenLastCalledWith("clave", {
      status: "descartado",
      questionId: null,
      skip: 0,
      limit: 20,
    });
    const descartadoCalls = getReportsMock.mock.calls.filter(
      ([, params]) => params.status === "descartado",
    );
    expect(descartadoCalls).toHaveLength(1);
    expect(descartadoCalls.some(([, params]) => params.skip === 20)).toBe(
      false,
    );
    expect(screen.getByText("Página 1")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    expect(getReportsMock).toHaveBeenLastCalledWith("clave", {
      status: "descartado",
      questionId: null,
      skip: 0,
      limit: 20,
    });
  });

  it("LIST-09 a page change keeps the filters and requests the next window", async () => {
    const user = userEvent.setup();
    render(<Admin />);
    await unlockToPage(user);

    await user.selectOptions(screen.getByLabelText("Estado"), "resuelto");
    await user.type(screen.getByLabelText("Id de la pregunta"), "42");
    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    expect(getReportsMock).toHaveBeenLastCalledWith("clave", {
      status: "resuelto",
      questionId: 42,
      skip: 0,
      limit: 20,
    });

    await screen.findByText("Página 1");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Siguiente" })).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(getReportsMock).toHaveBeenLastCalledWith("clave", {
      status: "resuelto",
      questionId: 42,
      skip: 20,
      limit: 20,
    });
    expect(screen.getByText("Página 2")).toBeVisible();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeEnabled();
  });

  it("LIST-10 an empty page is usable and the filters survive going back", async () => {
    const user = userEvent.setup();
    getReportsMock.mockResolvedValueOnce(PAGE_20);
    render(<Admin />);
    await unlockToPage(user);
    await user.selectOptions(screen.getByLabelText("Estado"), "descartado");
    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    getReportsMock.mockResolvedValueOnce([]);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Siguiente" })).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    await waitFor(() =>
      expect(screen.getByText("No hay reportes para mostrar.")).toBeVisible(),
    );
    expect(screen.getByText("No hay reportes para mostrar.")).toHaveAttribute(
      "role",
      "status",
    );
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Anterior" }));
    expect(getReportsMock).toHaveBeenLastCalledWith("clave", {
      status: "descartado",
      questionId: null,
      skip: 0,
      limit: 20,
    });
    expect((screen.getByLabelText("Estado") as HTMLSelectElement).value).toBe(
      "descartado",
    );
    await screen.findByText("Reporte 7");
  });

  it("LIST-11 a late page does not replace a newer filter", async () => {
    const user = userEvent.setup();
    const pendingPage = deferred<AdminReport[]>();
    getReportsMock
      .mockReset()
      .mockReturnValueOnce(pendingPage.promise)
      .mockResolvedValueOnce([F_DES]);
    render(<Admin />);
    await unlock(user);

    await user.selectOptions(screen.getByLabelText("Estado"), "descartado");
    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await screen.findByText("Reporte 9");

    pendingPage.resolve([F_PEN]);
    await flush();

    expect(screen.queryByText("Reporte 7")).not.toBeInTheDocument();
    expect(screen.getByText("Reporte 9")).toBeVisible();
  });

  it("LIST-11b a current page response still paints its rows", async () => {
    const user = userEvent.setup();
    const pendingPage = deferred<AdminReport[]>();
    getReportsMock.mockReset().mockReturnValueOnce(pendingPage.promise);
    render(<Admin />);
    await unlock(user);
    expect(screen.queryByText("Reporte 7")).not.toBeInTheDocument();

    pendingPage.resolve([F_PEN]);
    await screen.findByText("Reporte 7");
  });

  it("LIST-12 a question id is applied as a number and cleared as null", async () => {
    const user = userEvent.setup();
    render(<Admin />);
    await unlockToPage(user);

    const input = screen.getByLabelText("Id de la pregunta");
    await user.type(input, "42");
    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    expect(getReportsMock).toHaveBeenLastCalledWith("clave", {
      status: "pendiente",
      questionId: 42,
      skip: 0,
      limit: 20,
    });

    await user.clear(input);
    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    expect(getReportsMock).toHaveBeenLastCalledWith("clave", {
      status: "pendiente",
      questionId: null,
      skip: 0,
      limit: 20,
    });
  });
});

describe("Admin status change", () => {
  it("PATCH-03 one PATCH, then the page and the stats, then Estado actualizado.", async () => {
    const user = userEvent.setup();
    getReportStatsMock
      .mockReset()
      .mockResolvedValueOnce(S_MIX)
      .mockResolvedValueOnce(S_AFTER);
    getReportsMock
      .mockReset()
      .mockResolvedValueOnce(PAGE_20)
      .mockResolvedValueOnce(PAGE_19);
    render(<Admin />);
    await unlockToPage(user);

    await user.click(
      screen.getByRole("button", { name: "Marcar resuelto el reporte 7" }),
    );

    await waitFor(() =>
      expect(screen.getByText("Estado actualizado.")).toBeVisible(),
    );
    expect(updateReportStatusMock).toHaveBeenCalledTimes(1);
    expect(updateReportStatusMock).toHaveBeenCalledWith("clave", 7, "resuelto");
    expect(getReportsMock).toHaveBeenLastCalledWith("clave", {
      status: "pendiente",
      questionId: null,
      skip: 0,
      limit: 20,
    });
    expect(getReportStatsMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Estado actualizado.")).toHaveAttribute(
      "role",
      "status",
    );
    expect(screen.queryByText("Reporte 7")).not.toBeInTheDocument();
    expect(screen.getByText("Pendientes: 2")).toBeVisible();
  });

  it("PATCH-03b under Todos the row remains with Estado: Resuelto", async () => {
    const user = userEvent.setup();
    const resolvedRow: AdminReport = {
      ...F_PEN,
      status: "resuelto",
      resolved_at: "2026-10-27T09:30:00Z",
    };
    getReportsMock
      .mockReset()
      .mockResolvedValueOnce(PAGE_20)
      .mockResolvedValueOnce(PAGE_20)
      .mockResolvedValueOnce([resolvedRow]);
    render(<Admin />);
    await unlockToPage(user);

    await user.selectOptions(screen.getByLabelText("Estado"), "todos");
    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await screen.findByText("Reporte 7");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Marcar resuelto el reporte 7" }),
      ).toBeEnabled(),
    );

    await user.click(
      screen.getByRole("button", { name: "Marcar resuelto el reporte 7" }),
    );

    await waitFor(() =>
      expect(screen.getByText("Estado: Resuelto")).toBeVisible(),
    );
    expect(screen.getByText("Reporte 7")).toBeVisible();
    expect(screen.getByText("Estado actualizado.")).toBeVisible();
  });

  it("PATCH-04 a 404 says the report is gone, removes it and offers no retry", async () => {
    const user = userEvent.setup();
    updateReportStatusMock
      .mockReset()
      .mockRejectedValue(
        new ApiError("http", "Recurso no encontrado.", { status: 404 }),
      );
    getReportsMock
      .mockReset()
      .mockResolvedValueOnce(PAGE_20)
      .mockResolvedValueOnce(PAGE_19);
    render(<Admin />);
    await unlockToPage(user);

    await user.click(
      screen.getByRole("button", { name: "Marcar resuelto el reporte 7" }),
    );

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "El reporte ya no existe.",
      ),
    );
    expect(
      screen.queryByRole("button", { name: "Reintentar" }),
    ).not.toBeInTheDocument();
    expect(getReportsMock).toHaveBeenCalledTimes(2);
    await waitFor(() =>
      expect(screen.queryByText("Reporte 7")).not.toBeInTheDocument(),
    );
    expect(screen.queryByText("Estado actualizado.")).not.toBeInTheDocument();
  });

  it("PATCH-05 a 422 keeps the row, shows the detail and does not refetch", async () => {
    const user = userEvent.setup();
    updateReportStatusMock.mockReset().mockRejectedValue(
      new ApiError("http", "Los datos enviados no son válidos.", {
        status: 422,
        detail: "estado inválido",
      }),
    );
    render(<Admin />);
    await unlockToPage(user);
    const listCalls = getReportsMock.mock.calls.length;

    await user.click(
      screen.getByRole("button", { name: "Marcar resuelto el reporte 7" }),
    );

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "El cambio de estado no es válido.",
      ),
    );
    expect(screen.getByText("estado inválido")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Reintentar" }),
    ).not.toBeInTheDocument();
    expect(getReportsMock).toHaveBeenCalledTimes(listCalls);
    expect(screen.getAllByText("Estado: Pendiente").length).toBeGreaterThan(0);
  });

  it("PATCH-06 a double click sends one PATCH", async () => {
    const user = userEvent.setup();
    const pendingPatch = deferred<AdminReport>();
    updateReportStatusMock
      .mockReset()
      .mockReturnValueOnce(pendingPatch.promise);
    getReportsMock
      .mockReset()
      .mockResolvedValueOnce(PAGE_20)
      .mockResolvedValueOnce(PAGE_19);
    render(<Admin />);
    await unlockToPage(user);

    const button = screen.getByRole("button", {
      name: "Marcar resuelto el reporte 7",
    });
    act(() => {
      fireEvent.click(button);
      fireEvent.click(button);
    });

    expect(updateReportStatusMock).toHaveBeenCalledTimes(1);
    pendingPatch.resolve(F_RES);
    await flush();

    expect(getReportsMock).toHaveBeenCalledTimes(2);
    expect(getReportStatsMock).toHaveBeenCalledTimes(2);
  });

  it("PATCH-07 every status action is disabled while the PATCH and its refetch are pending", async () => {
    const user = userEvent.setup();
    const pendingPatch = deferred<AdminReport>();
    const pendingList = deferred<AdminReport[]>();
    updateReportStatusMock
      .mockReset()
      .mockReturnValueOnce(pendingPatch.promise);
    getReportsMock
      .mockReset()
      .mockResolvedValueOnce(PAGE_20)
      .mockReturnValueOnce(pendingList.promise);
    render(<Admin />);
    await unlockToPage(user);

    await user.click(
      screen.getByRole("button", { name: "Marcar resuelto el reporte 7" }),
    );

    expect(
      screen.getByRole("button", { name: "Marcar resuelto el reporte 1" }),
    ).toBeDisabled();
    expect(screen.getAllByText("Estado: Pendiente").length).toBeGreaterThan(0);

    pendingPatch.resolve(F_RES);
    await flush();
    expect(
      screen.getByRole("button", { name: "Marcar resuelto el reporte 1" }),
    ).toBeDisabled();
    expect(screen.getAllByText("Estado: Pendiente").length).toBeGreaterThan(0);

    pendingList.resolve(PAGE_19);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Marcar resuelto el reporte 1" }),
      ).toBeEnabled(),
    );
    expect(screen.queryByText("Reporte 7")).not.toBeInTheDocument();
  });

  it("F1 a filter applied while a PATCH is in flight wins the refetch", async () => {
    const user = userEvent.setup();
    const pendingPatch = deferred<AdminReport>();
    updateReportStatusMock
      .mockReset()
      .mockReturnValueOnce(pendingPatch.promise);
    getReportsMock
      .mockReset()
      .mockImplementation((_key, params) =>
        Promise.resolve(params.status === "descartado" ? [F_DES] : [F_PEN]),
      );
    render(<Admin />);
    await unlockToPage(user);

    await user.click(
      screen.getByRole("button", { name: "Marcar resuelto el reporte 7" }),
    );
    expect(updateReportStatusMock).toHaveBeenCalledTimes(1);

    await user.selectOptions(screen.getByLabelText("Estado"), "descartado");
    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await screen.findByText("Reporte 9");

    pendingPatch.resolve(F_RES);
    await waitFor(() => expect(getReportsMock).toHaveBeenCalledTimes(3));

    expect(getReportsMock).toHaveBeenLastCalledWith("clave", {
      status: "descartado",
      questionId: null,
      skip: 0,
      limit: 20,
    });
    expect(screen.getByText("Reporte 9")).toBeVisible();
    expect(screen.queryByText("Reporte 7")).not.toBeInTheDocument();
    expect((screen.getByLabelText("Estado") as HTMLSelectElement).value).toBe(
      "descartado",
    );
  });
});

describe("Admin failures", () => {
  it("ERR-11 a 503 on the list keeps the panel, the key and offers a manual retry", async () => {
    const user = userEvent.setup();
    getReportsMock
      .mockReset()
      .mockResolvedValueOnce(PAGE_20)
      .mockRejectedValueOnce(
        new ApiError("http", "Error del servidor.", { status: 503 }),
      )
      .mockResolvedValueOnce(PAGE_20);
    render(<Admin />);
    await unlockToPage(user);

    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "La API no tiene la clave de administración configurada.",
      ),
    );
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeVisible();
    expect(
      screen.queryByLabelText("Clave de administración"),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Reporte 7")).toBeVisible();
    expect(getReportsMock).toHaveBeenCalledTimes(3);
    expect(getReportsMock.mock.calls[1]).toEqual(getReportsMock.mock.calls[2]);
    expect(getReportsMock.mock.calls[2][0]).toBe("clave");
  });

  it("ERR-12 network and timeout retry the same list operation", async () => {
    const user = userEvent.setup();

    for (const kind of ["network", "timeout"] as const) {
      getReportsMock
        .mockReset()
        .mockResolvedValueOnce(PAGE_20)
        .mockResolvedValueOnce(PAGE_20)
        .mockRejectedValueOnce(new ApiError(kind, "Sin conexión."))
        .mockResolvedValueOnce(PAGE_20);
      const view = render(<Admin />);
      await unlockToPage(user);
      await user.selectOptions(screen.getByLabelText("Estado"), "resuelto");
      await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Siguiente" })).toBeEnabled(),
      );
      await user.click(screen.getByRole("button", { name: "Siguiente" }));

      await waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent(
          "¿Está corriendo la API?",
        ),
      );
      expect(screen.getByRole("button", { name: "Reintentar" })).toBeVisible();
      await user.click(screen.getByRole("button", { name: "Reintentar" }));
      expect(getReportsMock).toHaveBeenLastCalledWith("clave", {
        status: "resuelto",
        questionId: null,
        skip: 20,
        limit: 20,
      });
      await waitFor(() => expect(screen.getByText("Reporte 7")).toBeVisible());
      view.unmount();
    }
  });

  it("ERR-13 a 500 shows its message and not its detail", async () => {
    const user = userEvent.setup();
    getReportsMock
      .mockReset()
      .mockResolvedValueOnce(PAGE_20)
      .mockRejectedValueOnce(
        new ApiError("http", "Error del servidor.", {
          status: 500,
          detail: "boom",
        }),
      );
    render(<Admin />);
    await unlockToPage(user);

    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Error del servidor.",
      ),
    );
    expect(screen.queryByText("boom")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeVisible();
  });

  it("ERR-14 a malformed stats response shows the invalid-response message and its detail, no retry", async () => {
    const user = userEvent.setup();
    getReportStatsMock
      .mockReset()
      .mockResolvedValueOnce(S_MIX)
      .mockRejectedValueOnce(
        new ApiError("validation", "Respuesta inválida del servidor.", {
          detail: "contador de pendientes inválido",
        }),
      );
    getReportsMock.mockReset().mockResolvedValueOnce(PAGE_20);
    render(<Admin />);
    await unlockToPage(user);

    updateReportStatusMock.mockReset().mockResolvedValue(F_RES);
    getReportsMock.mockResolvedValueOnce(PAGE_19);
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
  });

  it("ERR-15 a failed status change logs without the key or the comment", async () => {
    const user = userEvent.setup();
    const privateReport = { ...F_PEN, comment: "texto privado" };
    getReportsMock.mockReset().mockResolvedValueOnce([privateReport]);
    updateReportStatusMock.mockReset().mockRejectedValue(
      new ApiError("http", "Los datos enviados no son válidos.", {
        status: 422,
        detail: "…",
      }),
    );
    const view = render(<Admin />);
    await unlockToPage(user);

    await user.click(
      screen.getByRole("button", { name: "Marcar resuelto el reporte 7" }),
    );
    await waitFor(() => expect(consoleErrorSpy).toHaveBeenCalled());

    expect(consoleErrorSpy.mock.calls[0][0]).toBe(
      "No se pudo actualizar el reporte",
    );
    expect(consoleErrorSpy.mock.calls[0][1]).toMatchObject({
      reportId: 7,
      kind: "http",
      status: 422,
    });
    const serialized = JSON.stringify(consoleErrorSpy.mock.calls);
    expect(serialized).not.toContain("clave");
    expect(serialized).not.toContain("X-API-Key");
    expect(serialized).not.toContain("texto privado");
    view.unmount();

    consoleErrorSpy.mockClear();
    updateReportStatusMock.mockReset().mockResolvedValue(F_RES);
    getReportsMock.mockReset().mockResolvedValue(PAGE_20);
    render(<Admin />);
    await unlockToPage(user);
    await user.click(
      screen.getByRole("button", { name: "Marcar resuelto el reporte 7" }),
    );
    await waitFor(() =>
      expect(screen.getByText("Estado actualizado.")).toBeVisible(),
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("ERR-16 a non-ApiError rejection shows the unexpected-failure copy", async () => {
    const user = userEvent.setup();
    getReportsMock
      .mockReset()
      .mockResolvedValueOnce(PAGE_20)
      .mockRejectedValueOnce(new Error("boom"));
    render(<Admin />);
    await unlockToPage(user);

    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Ocurrió un error inesperado.",
      ),
    );
    expect(
      screen.queryByRole("button", { name: "Reintentar" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Reportes" })).toBeVisible();
  });

  it("ERR-17 Reintentar after a stats failure repeats only the stats request", async () => {
    const user = userEvent.setup();
    getReportStatsMock
      .mockReset()
      .mockResolvedValueOnce(S_MIX)
      .mockRejectedValueOnce(new ApiError("network", "Sin conexión."))
      .mockResolvedValueOnce(S_MIX);
    getReportsMock
      .mockReset()
      .mockResolvedValueOnce(PAGE_20)
      .mockResolvedValueOnce(PAGE_19);
    render(<Admin />);
    await unlockToPage(user);

    await user.click(
      screen.getByRole("button", { name: "Marcar resuelto el reporte 7" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "¿Está corriendo la API?",
      ),
    );
    const listCalls = getReportsMock.mock.calls.length;
    expect(getReportStatsMock).toHaveBeenCalledTimes(2);

    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
    expect(getReportStatsMock).toHaveBeenCalledTimes(3);
    expect(getReportsMock).toHaveBeenCalledTimes(listCalls);
  });

  it("ERR-18 Reintentar after a PATCH failure repeats the same body", async () => {
    const user = userEvent.setup();
    updateReportStatusMock
      .mockReset()
      .mockRejectedValueOnce(new ApiError("network", "Sin conexión."))
      .mockResolvedValueOnce(F_RES);
    getReportsMock
      .mockReset()
      .mockResolvedValueOnce(PAGE_20)
      .mockResolvedValueOnce(PAGE_19);
    render(<Admin />);
    await unlockToPage(user);

    await user.click(
      screen.getByRole("button", { name: "Marcar resuelto el reporte 7" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "¿Está corriendo la API?",
      ),
    );
    expect(updateReportStatusMock).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() =>
      expect(updateReportStatusMock).toHaveBeenCalledTimes(2),
    );
    expect(updateReportStatusMock.mock.calls[1]).toEqual([
      "clave",
      7,
      "resuelto",
    ]);
    await waitFor(() => expect(getReportsMock).toHaveBeenCalledTimes(2));
    expect(getReportStatsMock).toHaveBeenCalledTimes(2);
  });

  it("ERR-19 the list and stats failures log kind and status without the key", async () => {
    const user = userEvent.setup();
    getReportsMock
      .mockReset()
      .mockResolvedValueOnce(PAGE_20)
      .mockRejectedValueOnce(
        new ApiError("http", "Error del servidor.", { status: 500 }),
      );
    const first = render(<Admin />);
    await unlockToPage(user);

    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    await waitFor(() => expect(consoleErrorSpy).toHaveBeenCalled());
    expect(consoleErrorSpy.mock.calls[0][0]).toBe(
      "No se pudieron cargar los reportes",
    );
    expect(consoleErrorSpy.mock.calls[0][1]).toMatchObject({
      kind: "http",
      status: 500,
    });

    consoleErrorSpy.mockClear();
    getReportStatsMock
      .mockReset()
      .mockResolvedValueOnce(S_MIX)
      .mockRejectedValueOnce(new ApiError("network", "Sin conexión."));
    getReportsMock
      .mockReset()
      .mockResolvedValueOnce(PAGE_20)
      .mockResolvedValueOnce(PAGE_19);
    updateReportStatusMock.mockReset().mockResolvedValue(F_RES);
    first.unmount();
    render(<Admin />);
    await unlockToPage(user);
    await user.click(
      screen.getByRole("button", { name: "Marcar resuelto el reporte 7" }),
    );
    await waitFor(() => expect(consoleErrorSpy).toHaveBeenCalled());
    expect(consoleErrorSpy.mock.calls[0][0]).toBe(
      "No se pudieron cargar las estadísticas",
    );
    expect(consoleErrorSpy.mock.calls[0][1]).toMatchObject({ kind: "network" });
    expect(JSON.stringify(consoleErrorSpy.mock.calls)).not.toContain("clave");
  });
});

describe("Admin accessibility", () => {
  it("A11Y-04 focus lands where the next action is", async () => {
    const user = userEvent.setup();
    render(<Admin />);
    expect(document.activeElement).toBe(keyInput());

    await unlock(user);
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("heading", { name: "Reportes" }),
      ),
    );
    expect(
      screen.queryByLabelText("Clave de administración"),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Reportes" })).toHaveAttribute(
      "tabindex",
      "-1",
    );

    await user.click(screen.getByRole("button", { name: "Salir" }));
    await waitFor(() => expect(document.activeElement).toBe(keyInput()));

    getReportsMock
      .mockReset()
      .mockRejectedValue(
        new ApiError("http", "Error en la solicitud.", { status: 401 }),
      );
    await user.type(keyInput(), "clave");
    await user.click(screen.getByRole("button", { name: "Ingresar" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "La clave dejó de ser válida. Volvé a ingresar la clave.",
      ),
    );
    await waitFor(() => expect(document.activeElement).toBe(keyInput()));
  });

  it("A11Y-05 the panel is keyboard operable", async () => {
    const user = userEvent.setup();
    render(<Admin />);
    await unlockToPage(user);

    const select = screen.getByLabelText("Estado");
    select.focus();
    await user.selectOptions(select, "descartado");
    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByLabelText("Id de la pregunta"),
    );
    await user.keyboard("42");
    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Aplicar filtros" }),
    );
    await user.keyboard("{Enter}");

    await waitFor(() =>
      expect(getReportsMock).toHaveBeenLastCalledWith("clave", {
        status: "descartado",
        questionId: 42,
        skip: 0,
        limit: 20,
      }),
    );
    await screen.findByText("Reporte 7");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Marcar resuelto el reporte 7" }),
      ).toBeEnabled(),
    );

    const resolved = screen.getByRole("button", {
      name: "Marcar resuelto el reporte 7",
    });
    resolved.focus();
    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Descartar el reporte 7" }),
    );
    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Abrir la pregunta 42" }),
    );
  });

  it("A11Y-06 names, roles and alert regions are exposed", async () => {
    const user = userEvent.setup();
    render(<Admin />);
    await unlockToPage(user);
    await user.click(
      screen.getByRole("button", { name: "Abrir la pregunta 42" }),
    );

    expect(
      screen.getByRole("heading", { name: "Administración" }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "Reportes" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Pregunta 42" })).toBeVisible();

    getReportsMock
      .mockReset()
      .mockRejectedValue(new ApiError("network", "Sin conexión."));
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "¿Está corriendo la API?",
      ),
    );
    expect(
      within(screen.getByRole("alert")).getByText("¿Está corriendo la API?"),
    ).toBeVisible();
  });
});
