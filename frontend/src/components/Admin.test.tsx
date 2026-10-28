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
import {
  getQuestion,
  getQuestionEdits,
  hideQuestion,
  updateQuestion,
} from "../api/questionEditing";
import type {
  AdminQuestion,
  AdminQuestionEdit,
  AdminQuestionUpdateResult,
  AdminReport,
  ReportStats,
} from "../api/types";
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

vi.mock("../api/questionEditing", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../api/questionEditing")>();
  return {
    ...actual,
    getQuestion: vi.fn(),
    updateQuestion: vi.fn(),
    hideQuestion: vi.fn(),
    getQuestionEdits: vi.fn(),
  };
});

const getReportStatsMock = vi.mocked(getReportStats);
const getReportsMock = vi.mocked(getReports);
const updateReportStatusMock = vi.mocked(updateReportStatus);
const getQuestionMock = vi.mocked(getQuestion);
const updateQuestionMock = vi.mocked(updateQuestion);
const hideQuestionMock = vi.mocked(hideQuestion);
const getQuestionEditsMock = vi.mocked(getQuestionEdits);

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

const F_Q42: AdminQuestion = {
  id: 42,
  question: "Capital of Peru?",
  answer: "Lima",
  wrong_1: "Quito",
  wrong_2: "Bogotá",
  wrong_3: "Santiago",
  category: "geografia",
  source: "ia",
  question_es: "¿Capital del Perú?",
  answer_es: "Lima",
  wrong_1_es: "Quito",
  wrong_2_es: "Bogotá",
  wrong_3_es: "Santiago",
  is_translated: true,
  translation_model: "gpt-4.1-mini",
  is_active: true,
};

const F_Q43: AdminQuestion = {
  ...F_Q42,
  id: 43,
  question: "Capital of Ecuador?",
  answer: "Quito",
  wrong_1: "Guayaquil",
  wrong_2: "Cuenca",
  wrong_3: "Loja",
  question_es: null,
  answer_es: null,
  wrong_1_es: null,
  wrong_2_es: null,
  wrong_3_es: null,
  is_translated: false,
  translation_model: null,
  is_active: false,
};

const H_ORDER: AdminQuestionEdit[] = [
  {
    id: 9,
    field: "question",
    old_value: "Capital of Peru?",
    new_value: "Capital of Peru (country)?",
    edited_at: "2026-10-26T12:00:00Z",
  },
  {
    id: 4,
    field: "is_active",
    old_value: "false",
    new_value: "true",
    edited_at: "2026-10-26T13:00:00Z",
  },
  {
    id: 7,
    field: "foo",
    old_value: "x",
    new_value: "y",
    edited_at: "2026-10-26T14:00:00Z",
  },
];

const PR_OK: AdminQuestionUpdateResult = {
  changed_fields: ["question", "wrong_2"],
  question: {
    ...F_Q42,
    question: "Capital of Peru (country)?",
    wrong_2: "Arequipa",
  },
};

const PR_EMPTY: AdminQuestionUpdateResult = {
  changed_fields: [],
  question: { ...F_Q42 },
};

const PR_HIDDEN: AdminQuestionUpdateResult = {
  changed_fields: ["is_active"],
  question: { ...F_Q43, is_active: true },
};

const PR_RESTORED_Q42: AdminQuestionUpdateResult = {
  changed_fields: ["is_active"],
  question: { ...F_Q42, is_active: true },
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
  getQuestionMock.mockReset().mockResolvedValue(F_Q42);
  getQuestionEditsMock.mockReset().mockResolvedValue(H_ORDER);
  updateQuestionMock.mockReset().mockResolvedValue(PR_OK);
  hideQuestionMock.mockReset().mockResolvedValue({ id: 42, is_active: false });
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
  consoleLogSpy.mockRestore();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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

function editorRegion(questionId = 42): HTMLElement {
  return screen.getByRole("region", {
    name: `Editar pregunta ${questionId}`,
  });
}

function editorField(label: string): HTMLInputElement {
  return screen.getByLabelText(label) as HTMLInputElement;
}

async function openEditorFromRow(
  user: ReturnType<typeof userEvent.setup>,
  questionId = 42,
) {
  await user.click(
    screen.getByRole("button", { name: `Abrir la pregunta ${questionId}` }),
  );
  await user.click(
    screen.getByRole("button", { name: `Editar pregunta ${questionId}` }),
  );
  return screen.findByRole("region", {
    name: `Editar pregunta ${questionId}`,
  });
}

async function openEditorByNumber(
  user: ReturnType<typeof userEvent.setup>,
  questionId: number,
) {
  await user.type(screen.getByLabelText("Pregunta"), String(questionId));
  await user.click(screen.getByRole("button", { name: "Abrir editor" }));
  return screen.findByRole("region", {
    name: `Editar pregunta ${questionId}`,
  });
}

async function saveEditor(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
}

describe("Admin question editor", () => {
  it("QORCH-01 opening from the report row fires both requests in parallel and the question gates", async () => {
    const user = userEvent.setup();
    const questionDeferred = deferred<AdminQuestion>();
    const editsDeferred = deferred<AdminQuestionEdit[]>();
    getQuestionMock.mockReset().mockReturnValueOnce(questionDeferred.promise);
    getQuestionEditsMock.mockReset().mockReturnValueOnce(editsDeferred.promise);
    render(<Admin />);
    await unlockToPage(user);

    await user.click(
      screen.getByRole("button", { name: "Abrir la pregunta 42" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Editar pregunta 42" }),
    );

    expect(getQuestionMock).toHaveBeenCalledTimes(1);
    expect(getQuestionMock).toHaveBeenCalledWith("clave", 42);
    expect(getQuestionEditsMock).toHaveBeenCalledTimes(1);
    expect(getQuestionEditsMock).toHaveBeenCalledWith("clave", 42);

    const region = editorRegion();
    expect(within(region).getByRole("status")).toHaveTextContent(
      "Cargando pregunta...",
    );
    expect(within(region).queryByRole("form")).not.toBeInTheDocument();
    expect(
      within(region).queryByText("Historial de ediciones"),
    ).not.toBeInTheDocument();

    await act(async () => {
      questionDeferred.resolve(F_Q42);
    });

    expect(editorField("Pregunta en inglés").value).toBe("Capital of Peru?");
    expect(editorField("Opción incorrecta 1 en inglés").value).toBe("Quito");
    expect(editorField("Opción incorrecta 2 en inglés").value).toBe("Bogotá");
    expect(editorField("Opción incorrecta 3 en inglés").value).toBe("Santiago");
    expect(screen.getByText("geografia")).toBeVisible();
    expect(screen.getByText("gpt-4.1-mini")).toBeVisible();
    expect(
      within(editorRegion()).getByText("Cargando historial..."),
    ).toBeVisible();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("heading", { name: "Editar pregunta 42" }),
      ),
    );

    await act(async () => {
      editsDeferred.resolve(H_ORDER);
    });
    expect(await screen.findByText("Campo: Pregunta en inglés")).toBeVisible();
    expect(screen.queryByText("Cargando historial...")).not.toBeInTheDocument();
  });

  it("QORCH-02 opening from the number form fires both requests once", async () => {
    const user = userEvent.setup();
    render(<Admin />);
    await unlockToPage(user);

    await openEditorByNumber(user, 42);

    expect(getQuestionMock).toHaveBeenCalledTimes(1);
    expect(getQuestionMock).toHaveBeenCalledWith("clave", 42);
    expect(getQuestionEditsMock).toHaveBeenCalledTimes(1);
    expect(getQuestionEditsMock).toHaveBeenCalledWith("clave", 42);
  });

  it("QORCH-03 opening the already open question makes no request and focuses the heading", async () => {
    const user = userEvent.setup();
    render(<Admin />);
    await unlockToPage(user);
    await openEditorFromRow(user);

    const questionCalls = getQuestionMock.mock.calls.length;
    const editsCalls = getQuestionEditsMock.mock.calls.length;

    await user.click(
      screen.getByRole("button", { name: "Editar pregunta 42" }),
    );

    expect(getQuestionMock).toHaveBeenCalledTimes(questionCalls);
    expect(getQuestionEditsMock).toHaveBeenCalledTimes(editsCalls);
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("heading", { name: "Editar pregunta 42" }),
      ),
    );
  });

  it("QORCH-04 opening question 43 replaces 42 with two requests for 43", async () => {
    const user = userEvent.setup();
    getReportsMock
      .mockReset()
      .mockResolvedValue([F_PEN, { ...F_RES, question_id: 43 }]);
    getQuestionMock
      .mockReset()
      .mockImplementation((_key, id) =>
        Promise.resolve(id === 43 ? F_Q43 : F_Q42),
      );
    render(<Admin />);
    await unlockToPage(user);
    await openEditorFromRow(user, 42);

    const questionsBefore = getQuestionMock.mock.calls.length;
    const editsBefore = getQuestionEditsMock.mock.calls.length;

    await user.click(
      screen.getByRole("button", { name: "Abrir la pregunta 43" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Editar pregunta 43" }),
    );

    expect(getQuestionMock).toHaveBeenCalledTimes(questionsBefore + 1);
    expect(getQuestionMock).toHaveBeenLastCalledWith("clave", 43);
    expect(getQuestionEditsMock).toHaveBeenCalledTimes(editsBefore + 1);
    expect(getQuestionEditsMock).toHaveBeenLastCalledWith("clave", 43);
    expect(
      screen.getByRole("heading", { name: "Editar pregunta 43" }),
    ).toBeVisible();
  });

  it("QORCH-05 a failed question stays closed, shows the panel alert and Reintentar repeats both", async () => {
    const user = userEvent.setup();
    getQuestionMock
      .mockReset()
      .mockRejectedValueOnce(
        new ApiError("http", "Error del servidor.", { status: 503 }),
      )
      .mockResolvedValueOnce(F_Q42);
    render(<Admin />);
    await unlockToPage(user);

    await user.click(
      screen.getByRole("button", { name: "Abrir la pregunta 42" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Editar pregunta 42" }),
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "La API no tiene la clave de administración configurada.",
    );
    expect(
      screen.queryByRole("region", { name: "Editar pregunta 42" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    await screen.findByRole("region", { name: "Editar pregunta 42" });
    expect(getQuestionMock).toHaveBeenCalledTimes(2);
    expect(getQuestionMock).toHaveBeenLastCalledWith("clave", 42);
    expect(getQuestionEditsMock).toHaveBeenCalledTimes(2);
    expect(getQuestionEditsMock).toHaveBeenLastCalledWith("clave", 42);
  });

  it("QORCH-06 a failed open with a 404 shows the question copy and no Reintentar", async () => {
    const user = userEvent.setup();
    getQuestionMock
      .mockReset()
      .mockRejectedValueOnce(
        new ApiError("http", "Recurso no encontrado.", { status: 404 }),
      );
    render(<Admin />);
    await unlockToPage(user);

    await user.click(
      screen.getByRole("button", { name: "Abrir la pregunta 42" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Editar pregunta 42" }),
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("La pregunta ya no existe.");
    expect(
      screen.queryByRole("button", { name: "Reintentar" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Editar pregunta 42" }),
    ).not.toBeInTheDocument();
  });

  it("QORCH-07 a failed open with a network error shows ¿Está corriendo la API? and retries both", async () => {
    const user = userEvent.setup();
    getQuestionMock
      .mockReset()
      .mockRejectedValueOnce(new ApiError("network", "Sin conexión."))
      .mockResolvedValueOnce(F_Q42);
    render(<Admin />);
    await unlockToPage(user);

    await user.click(
      screen.getByRole("button", { name: "Abrir la pregunta 42" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Editar pregunta 42" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "¿Está corriendo la API?",
    );
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    await screen.findByRole("region", { name: "Editar pregunta 42" });
    expect(getQuestionMock).toHaveBeenCalledTimes(2);
    expect(getQuestionEditsMock).toHaveBeenCalledTimes(2);
  });

  it("QORCH-08 a save sends one PATCH, then refreshes the history and the current report page", async () => {
    const user = userEvent.setup();
    render(<Admin />);
    await unlockToPage(user);
    await openEditorFromRow(user);
    await screen.findByText("Campo: Pregunta en inglés");

    fireEvent.change(editorField("Opción incorrecta 2 en inglés"), {
      target: { value: "Arequipa" },
    });
    await saveEditor(user);

    expect(updateQuestionMock).toHaveBeenCalledTimes(1);
    expect(updateQuestionMock).toHaveBeenCalledWith("clave", 42, {
      wrong_2: "Arequipa",
    });
    expect(
      await screen.findByText(
        "Campos guardados: Pregunta en inglés, Opción incorrecta 2 en inglés.",
      ),
    ).toBeVisible();
    expect(editorField("Opción incorrecta 2 en inglés").value).toBe("Arequipa");
    expect(editorField("Pregunta en inglés").value).toBe(
      "Capital of Peru (country)?",
    );
    expect(
      screen.getByText(
        "Para que esta corrección sobreviva a una recarga de la base, corré: poetry run python -m app.export_admin_edits",
      ),
    ).toBeVisible();

    expect(getQuestionEditsMock).toHaveBeenCalledTimes(2);
    expect(getQuestionEditsMock).toHaveBeenLastCalledWith("clave", 42);
    expect(getReportsMock).toHaveBeenCalledTimes(2);
    expect(getReportsMock).toHaveBeenLastCalledWith("clave", {
      status: "pendiente",
      questionId: null,
      skip: 0,
      limit: 20,
    });
  });

  it("QORCH-09 a double submit sends one PATCH", async () => {
    const user = userEvent.setup();
    const pendingWrite = deferred<AdminQuestionUpdateResult>();
    updateQuestionMock.mockReset().mockReturnValueOnce(pendingWrite.promise);
    render(<Admin />);
    await unlockToPage(user);
    await openEditorFromRow(user);

    fireEvent.change(editorField("Opción incorrecta 2 en inglés"), {
      target: { value: "Arequipa" },
    });
    const save = screen.getByRole("button", { name: "Guardar cambios" });
    act(() => {
      fireEvent.click(save);
      fireEvent.click(save);
    });
    expect(updateQuestionMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      pendingWrite.resolve(PR_OK);
    });
    expect(updateQuestionMock).toHaveBeenCalledTimes(1);
  });

  it("QORCH-10 a hide sends one DELETE and refreshes both surfaces", async () => {
    const user = userEvent.setup();
    render(<Admin />);
    await unlockToPage(user);
    await openEditorFromRow(user);

    await user.click(screen.getByRole("button", { name: "Ocultar pregunta" }));
    await user.click(screen.getByRole("button", { name: "Confirmar ocultar" }));

    expect(hideQuestionMock).toHaveBeenCalledTimes(1);
    expect(hideQuestionMock).toHaveBeenCalledWith("clave", 42);
    expect(await screen.findByText("Pregunta oculta.")).toBeVisible();
    expect(screen.getByText("Oculta")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Volver a mostrar" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Ocultar pregunta" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Para que esta corrección sobreviva a una recarga de la base, corré: poetry run python -m app.export_admin_edits",
      ),
    ).toBeVisible();
    expect(getQuestionEditsMock).toHaveBeenCalledTimes(2);
    expect(getReportsMock).toHaveBeenCalledTimes(2);
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("heading", { name: "Editar pregunta 42" }),
      ),
    );
  });

  it('QORCH-11 restore sends exactly {"is_active":true} and refreshes both surfaces', async () => {
    const user = userEvent.setup();
    getQuestionMock.mockReset().mockResolvedValue(F_Q43);
    updateQuestionMock.mockReset().mockResolvedValueOnce(PR_HIDDEN);
    render(<Admin />);
    await unlockToPage(user);
    await openEditorByNumber(user, 43);

    await user.click(screen.getByRole("button", { name: "Volver a mostrar" }));

    expect(updateQuestionMock).toHaveBeenCalledTimes(1);
    expect(updateQuestionMock).toHaveBeenCalledWith("clave", 43, {
      is_active: true,
    });
    expect(await screen.findByText("Pregunta visible de nuevo.")).toBeVisible();
    expect(screen.getByText("Visible")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Ocultar pregunta" }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Para que esta corrección sobreviva a una recarga de la base, corré: poetry run python -m app.export_admin_edits",
      ),
    ).toBeVisible();
    expect(getQuestionEditsMock).toHaveBeenCalledTimes(2);
    expect(getQuestionEditsMock).toHaveBeenLastCalledWith("clave", 43);
    expect(getReportsMock).toHaveBeenCalledTimes(2);
  });

  it("QORCH-12 a 422 keeps the draft and shows the normalized detail with no retry", async () => {
    const user = userEvent.setup();
    updateQuestionMock.mockReset().mockRejectedValue(
      new ApiError("http", "Los datos enviados no son válidos.", {
        status: 422,
        detail: "las opciones deben ser distintas",
      }),
    );
    render(<Admin />);
    await unlockToPage(user);
    await openEditorFromRow(user);

    fireEvent.change(editorField("Opción incorrecta 2 en inglés"), {
      target: { value: "Arequipa" },
    });
    await saveEditor(user);

    const alert = await within(editorRegion()).findByRole("alert");
    expect(alert).toHaveTextContent("El cambio no es válido.");
    expect(alert).toHaveTextContent("las opciones deben ser distintas");
    expect(
      within(editorRegion()).queryByRole("button", { name: "Reintentar" }),
    ).not.toBeInTheDocument();
    expect(editorField("Opción incorrecta 2 en inglés").value).toBe("Arequipa");
    expect(getQuestionEditsMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/^Campos guardados:/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "Para que esta corrección sobreviva a una recarga de la base, corré: poetry run python -m app.export_admin_edits",
      ),
    ).not.toBeInTheDocument();
  });

  it("QORCH-13 a 404 on save closes the editor with the panel copy and no retry", async () => {
    const user = userEvent.setup();
    updateQuestionMock
      .mockReset()
      .mockRejectedValue(
        new ApiError("http", "Recurso no encontrado.", { status: 404 }),
      );
    render(<Admin />);
    await unlockToPage(user);
    await openEditorFromRow(user);

    fireEvent.change(editorField("Opción incorrecta 2 en inglés"), {
      target: { value: "Arequipa" },
    });
    await saveEditor(user);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("La pregunta ya no existe.");
    expect(
      screen.queryByRole("region", { name: "Editar pregunta 42" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Reintentar" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("El reporte ya no existe."),
    ).not.toBeInTheDocument();
  });

  it("QORCH-14 a server error keeps the editor open and does not echo the detail", async () => {
    const user = userEvent.setup();
    updateQuestionMock.mockReset().mockRejectedValue(
      new ApiError("http", "Error del servidor.", {
        status: 500,
        detail: "boom",
      }),
    );
    render(<Admin />);
    await unlockToPage(user);
    await openEditorFromRow(user);

    fireEvent.change(editorField("Opción incorrecta 2 en inglés"), {
      target: { value: "Arequipa" },
    });
    await saveEditor(user);

    const alert = await within(editorRegion()).findByRole("alert");
    expect(alert).toHaveTextContent("Error del servidor.");
    expect(alert).not.toHaveTextContent("boom");
    expect(
      within(editorRegion()).getByRole("button", { name: "Reintentar" }),
    ).toBeVisible();
    expect(editorField("Opción incorrecta 2 en inglés").value).toBe("Arequipa");
  });

  it("QORCH-15 network and 503 retry exactly the failed operation", async () => {
    const user = userEvent.setup();
    updateQuestionMock
      .mockReset()
      .mockRejectedValueOnce(new ApiError("network", "Sin conexión."))
      .mockResolvedValueOnce(PR_OK);
    const first = render(<Admin />);
    await unlockToPage(user);
    await openEditorFromRow(user);
    fireEvent.change(editorField("Opción incorrecta 2 en inglés"), {
      target: { value: "Arequipa" },
    });
    await saveEditor(user);

    expect(await within(editorRegion()).findByRole("alert")).toHaveTextContent(
      "¿Está corriendo la API?",
    );
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(updateQuestionMock).toHaveBeenCalledTimes(2));
    expect(updateQuestionMock.mock.calls[1]).toEqual(
      updateQuestionMock.mock.calls[0],
    );
    first.unmount();

    updateQuestionMock.mockReset().mockResolvedValue(PR_OK);
    hideQuestionMock
      .mockReset()
      .mockRejectedValueOnce(
        new ApiError("http", "Error del servidor.", { status: 503 }),
      )
      .mockResolvedValueOnce({ id: 42, is_active: false });
    render(<Admin />);
    await unlockToPage(user);
    await openEditorFromRow(user);
    await user.click(screen.getByRole("button", { name: "Ocultar pregunta" }));
    await user.click(screen.getByRole("button", { name: "Confirmar ocultar" }));

    expect(await within(editorRegion()).findByRole("alert")).toHaveTextContent(
      "La API no tiene la clave de administración configurada.",
    );
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(hideQuestionMock).toHaveBeenCalledTimes(2));
    expect(updateQuestionMock).not.toHaveBeenCalled();
  });

  it("QORCH-16 a 401 on an editor request returns to the gate and clears the editor", async () => {
    const user = userEvent.setup();
    updateQuestionMock
      .mockReset()
      .mockRejectedValue(
        new ApiError("http", "Error en la solicitud.", { status: 401 }),
      );
    render(<Admin />);
    await unlockToPage(user);
    await openEditorFromRow(user);
    fireEvent.change(editorField("Opción incorrecta 2 en inglés"), {
      target: { value: "Arequipa" },
    });
    await saveEditor(user);

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "La clave dejó de ser válida. Volvé a ingresar la clave.",
      ),
    );
    expect(keyInput()).toBeVisible();
    expect(
      screen.queryByRole("region", { name: "Editar pregunta 42" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Pregunta en inglés"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Historial de ediciones"),
    ).not.toBeInTheDocument();

    const calls = [
      getQuestionMock.mock.calls.length,
      getQuestionEditsMock.mock.calls.length,
      updateQuestionMock.mock.calls.length,
    ];
    await flush();
    expect(getQuestionMock.mock.calls.length).toBe(calls[0]);
    expect(getQuestionEditsMock.mock.calls.length).toBe(calls[1]);
    expect(updateQuestionMock.mock.calls.length).toBe(calls[2]);
  });

  it("QORCH-17 a late load for 42 does not paint over 43", async () => {
    const user = userEvent.setup();
    const question42 = deferred<AdminQuestion>();
    const edits42 = deferred<AdminQuestionEdit[]>();
    getReportsMock
      .mockReset()
      .mockResolvedValue([F_PEN, { ...F_RES, question_id: 43 }]);
    getQuestionMock
      .mockReset()
      .mockImplementation((_key, id) =>
        id === 42 ? question42.promise : Promise.resolve(F_Q43),
      );
    getQuestionEditsMock
      .mockReset()
      .mockImplementation((_key, id) =>
        id === 42 ? edits42.promise : Promise.resolve([]),
      );
    render(<Admin />);
    await unlockToPage(user);

    await user.click(
      screen.getByRole("button", { name: "Abrir la pregunta 42" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Editar pregunta 42" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Abrir la pregunta 43" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Editar pregunta 43" }),
    );
    await screen.findByRole("region", { name: "Editar pregunta 43" });
    expect(editorField("Pregunta en inglés").value).toBe("Capital of Ecuador?");

    await act(async () => {
      question42.resolve(F_Q42);
      edits42.resolve(H_ORDER);
    });
    await flush();

    expect(
      screen.getByRole("heading", { name: "Editar pregunta 43" }),
    ).toBeVisible();
    expect(editorField("Pregunta en inglés").value).toBe("Capital of Ecuador?");
    expect(
      screen.queryByDisplayValue("Capital of Peru?"),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("QORCH-18 a late save does not repaint a newly opened 43", async () => {
    const user = userEvent.setup();
    const pendingWrite = deferred<AdminQuestionUpdateResult>();
    updateQuestionMock.mockReset().mockReturnValueOnce(pendingWrite.promise);
    getQuestionMock
      .mockReset()
      .mockImplementation((_key, id) =>
        Promise.resolve(id === 43 ? F_Q43 : F_Q42),
      );
    render(<Admin />);
    await unlockToPage(user);
    await openEditorFromRow(user);

    fireEvent.change(editorField("Opción incorrecta 2 en inglés"), {
      target: { value: "Arequipa" },
    });
    await saveEditor(user);
    await user.click(screen.getByRole("button", { name: "Cerrar" }));
    await openEditorByNumber(user, 43);

    await act(async () => {
      pendingWrite.resolve(PR_OK);
    });
    await flush();

    expect(
      screen.getByRole("heading", { name: "Editar pregunta 43" }),
    ).toBeVisible();
    expect(editorField("Pregunta en inglés").value).toBe("Capital of Ecuador?");
    expect(
      screen.queryByText("Capital of Peru (country)?"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/^Campos guardados:/)).not.toBeInTheDocument();
  });

  it("QORCH-19 closing discards the draft, focuses Reportes and reopens from the server", async () => {
    const user = userEvent.setup();
    render(<Admin />);
    await unlockToPage(user);
    await openEditorFromRow(user);

    fireEvent.change(editorField("Opción incorrecta 2 en inglés"), {
      target: { value: "Oruro" },
    });
    await user.click(screen.getByRole("button", { name: "Cerrar" }));

    expect(
      screen.queryByRole("region", { name: "Editar pregunta 42" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Historial de ediciones"),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("heading", { name: "Reportes" }),
      ),
    );

    await openEditorByNumber(user, 42);
    expect(getQuestionMock).toHaveBeenCalledTimes(2);
    expect(getQuestionEditsMock).toHaveBeenCalledTimes(2);
    expect(editorField("Opción incorrecta 2 en inglés").value).toBe("Bogotá");
  });

  it("QORCH-20 a stale 401 from a closed editor does not lock a new session", async () => {
    const user = userEvent.setup();
    const pendingQuestion = deferred<AdminQuestion>();
    getQuestionMock.mockReset().mockReturnValueOnce(pendingQuestion.promise);
    render(<Admin />);
    await unlock(user, "claveA");
    await screen.findByText("Reporte 7");

    await user.click(
      screen.getByRole("button", { name: "Abrir la pregunta 42" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Editar pregunta 42" }),
    );
    await user.click(screen.getByRole("button", { name: "Cerrar" }));
    await user.click(screen.getByRole("button", { name: "Salir" }));
    await unlock(user, "claveB");
    await screen.findByText("Reporte 7");

    pendingQuestion.reject(
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

  it("QORCH-21 a failed editor request logs the id, kind and status and never the key or the text", async () => {
    const user = userEvent.setup();
    updateQuestionMock.mockReset().mockRejectedValue(
      new ApiError("http", "Los datos enviados no son válidos.", {
        status: 422,
        detail: "…",
      }),
    );
    render(<Admin />);
    await unlockToPage(user);
    await openEditorFromRow(user);
    fireEvent.change(editorField("Opción incorrecta 2 en inglés"), {
      target: { value: "texto privado" },
    });
    await saveEditor(user);
    await waitFor(() => expect(consoleErrorSpy).toHaveBeenCalled());

    expect(consoleErrorSpy.mock.calls[0][0]).toBe(
      "No se pudo guardar la pregunta",
    );
    expect(consoleErrorSpy.mock.calls[0][1]).toMatchObject({
      questionId: 42,
      kind: "http",
      status: 422,
    });
    const serialized = JSON.stringify(consoleErrorSpy.mock.calls);
    expect(serialized).not.toContain("clave");
    expect(serialized).not.toContain("X-API-Key");
    expect(serialized).not.toContain("texto privado");

    consoleErrorSpy.mockClear();
    updateQuestionMock.mockReset().mockResolvedValue(PR_OK);
    await saveEditor(user);
    await screen.findByText(/^Campos guardados:/);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("QORCH-22 the editor writes no storage and constructs no AudioContext", async () => {
    const user = userEvent.setup();
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    const cookieSpy = vi.spyOn(Document.prototype, "cookie", "set");
    const audioSpy = vi.fn();
    vi.stubGlobal("AudioContext", audioSpy);
    new (audioSpy as unknown as new () => unknown)();
    expect(audioSpy).toHaveBeenCalledTimes(1);
    audioSpy.mockClear();
    updateQuestionMock
      .mockReset()
      .mockResolvedValueOnce(PR_OK)
      .mockResolvedValueOnce(PR_RESTORED_Q42);

    render(<Admin />);
    await unlockToPage(user);
    await openEditorFromRow(user);
    fireEvent.change(editorField("Opción incorrecta 2 en inglés"), {
      target: { value: "Arequipa" },
    });
    await saveEditor(user);
    await screen.findByText(/^Campos guardados:/);
    await user.click(screen.getByRole("button", { name: "Ocultar pregunta" }));
    await user.click(screen.getByRole("button", { name: "Confirmar ocultar" }));
    await screen.findByText("Pregunta oculta.");
    await user.click(screen.getByRole("button", { name: "Volver a mostrar" }));
    await screen.findByText("Pregunta visible de nuevo.");

    for (const call of setItemSpy.mock.calls) {
      const serialized = JSON.stringify(call);
      expect(serialized).not.toContain("clave");
      expect(serialized).not.toContain("Arequipa");
    }
    expect(cookieSpy).not.toHaveBeenCalled();
    expect(document.cookie).toBe("");
    expect(audioSpy).not.toHaveBeenCalled();

    setItemSpy.mockRestore();
    cookieSpy.mockRestore();
  });

  it("QORCH-23 a failed history refresh retries only the history and keeps the saved question and status", async () => {
    const user = userEvent.setup();
    getQuestionEditsMock
      .mockReset()
      .mockResolvedValueOnce(H_ORDER)
      .mockRejectedValueOnce(new ApiError("network", "Sin conexión."))
      .mockResolvedValueOnce(H_ORDER);
    render(<Admin />);
    await unlockToPage(user);
    await openEditorFromRow(user);
    await screen.findByText("Campo: Pregunta en inglés");

    fireEvent.change(editorField("Opción incorrecta 2 en inglés"), {
      target: { value: "Arequipa" },
    });
    await saveEditor(user);
    await screen.findByText(
      "Campos guardados: Pregunta en inglés, Opción incorrecta 2 en inglés.",
    );
    const alert = await within(editorRegion()).findByRole("alert");
    expect(alert).toHaveTextContent("No se pudo cargar el historial.");
    expect(alert).toHaveTextContent("¿Está corriendo la API?");
    expect(
      within(alert).getByRole("button", { name: "Reintentar el historial" }),
    ).toBeVisible();
    expect(
      screen.queryByText("Campo: Pregunta en inglés"),
    ).not.toBeInTheDocument();
    expect(editorField("Opción incorrecta 2 en inglés").value).toBe("Arequipa");
    expect(
      screen.getByRole("button", { name: "Guardar cambios" }),
    ).toBeEnabled();

    await user.click(
      within(alert).getByRole("button", { name: "Reintentar el historial" }),
    );
    await screen.findByText("Campo: Pregunta en inglés");
    expect(getQuestionEditsMock).toHaveBeenCalledTimes(3);
    expect(updateQuestionMock).toHaveBeenCalledTimes(1);
    expect(getReportsMock).toHaveBeenCalledTimes(2);
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("heading", { name: "Historial de ediciones" }),
      ),
    );
  });

  it("QORCH-24 a null patch shows No hay cambios para guardar. with no request or refetch", async () => {
    const user = userEvent.setup();
    render(<Admin />);
    await unlockToPage(user);
    await openEditorFromRow(user);

    fireEvent.change(editorField("Respuesta en inglés"), {
      target: { value: "  Lima  " },
    });
    await saveEditor(user);

    expect(within(editorRegion()).getByRole("status")).toHaveTextContent(
      "No hay cambios para guardar.",
    );
    expect(updateQuestionMock).not.toHaveBeenCalled();
    expect(getQuestionEditsMock).toHaveBeenCalledTimes(1);
    expect(getReportsMock).toHaveBeenCalledTimes(1);
  });

  it("QORCH-25 an empty changed_fields shows No se guardó ningún cambio. without reminder", async () => {
    const user = userEvent.setup();
    updateQuestionMock.mockReset().mockResolvedValue(PR_EMPTY);
    render(<Admin />);
    await unlockToPage(user);
    await openEditorFromRow(user);

    fireEvent.change(editorField("Opción incorrecta 2 en inglés"), {
      target: { value: "Arequipa" },
    });
    await saveEditor(user);

    expect(
      await within(editorRegion()).findByText("No se guardó ningún cambio."),
    ).toBeVisible();
    expect(screen.queryByText(/^Campos guardados:/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "Para que esta corrección sobreviva a una recarga de la base, corré: poetry run python -m app.export_admin_edits",
      ),
    ).not.toBeInTheDocument();
    expect(getQuestionEditsMock).toHaveBeenCalledTimes(2);
    expect(getReportsMock).toHaveBeenCalledTimes(2);
  });

  it("QORCH-26 no request body ever contains is_active false across hide, restore and save", async () => {
    const user = userEvent.setup();
    updateQuestionMock
      .mockReset()
      .mockResolvedValueOnce(PR_RESTORED_Q42)
      .mockResolvedValueOnce(PR_OK);
    render(<Admin />);
    await unlockToPage(user);
    await openEditorFromRow(user);

    await user.click(screen.getByRole("button", { name: "Ocultar pregunta" }));
    await user.click(screen.getByRole("button", { name: "Confirmar ocultar" }));
    await screen.findByText("Pregunta oculta.");
    await user.click(screen.getByRole("button", { name: "Volver a mostrar" }));
    await screen.findByText("Pregunta visible de nuevo.");
    fireEvent.change(editorField("Opción incorrecta 2 en inglés"), {
      target: { value: "Arequipa" },
    });
    await saveEditor(user);
    await screen.findByText(/^Campos guardados:/);

    expect(hideQuestionMock).toHaveBeenCalledTimes(1);
    expect(updateQuestionMock).toHaveBeenCalledTimes(2);
    expect(updateQuestionMock.mock.calls[0]).toEqual([
      "clave",
      42,
      { is_active: true },
    ]);
    expect(updateQuestionMock.mock.calls[1]).toEqual([
      "clave",
      42,
      { wrong_2: "Arequipa" },
    ]);
    expect(JSON.stringify(updateQuestionMock.mock.calls)).not.toContain(
      '"is_active":false',
    );
  });

  it("QORCH-27 a save on a hidden question leaves Oculta and sends no is_active", async () => {
    const user = userEvent.setup();
    getQuestionMock.mockReset().mockResolvedValue(F_Q43);
    updateQuestionMock.mockReset().mockResolvedValue({
      changed_fields: ["question"],
      question: {
        ...F_Q43,
        question: "Capital of Ecuador (country)?",
      },
    });
    render(<Admin />);
    await unlockToPage(user);
    await openEditorByNumber(user, 43);

    fireEvent.change(editorField("Pregunta en inglés"), {
      target: { value: "Capital of Ecuador (country)?" },
    });
    await saveEditor(user);
    await screen.findByText(/^Campos guardados:/);

    expect(updateQuestionMock).toHaveBeenCalledWith("clave", 43, {
      question: "Capital of Ecuador (country)?",
    });
    expect(screen.getByText("Oculta")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Volver a mostrar" }),
    ).toBeVisible();
  });

  it("QORCH-28 a save after applying a filter refetches that filter's page", async () => {
    const user = userEvent.setup();
    render(<Admin />);
    await unlockToPage(user);
    await user.selectOptions(screen.getByLabelText("Estado"), "descartado");
    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await screen.findByText("Reporte 7");
    await openEditorFromRow(user);

    fireEvent.change(editorField("Opción incorrecta 2 en inglés"), {
      target: { value: "Arequipa" },
    });
    await saveEditor(user);
    await screen.findByText(/^Campos guardados:/);

    expect(getReportsMock).toHaveBeenLastCalledWith("clave", {
      status: "descartado",
      questionId: null,
      skip: 0,
      limit: 20,
    });
  });

  it("QORCH-29 a local validation error never reaches the API", async () => {
    const user = userEvent.setup();
    const cases: [string, string, string][] = [
      [
        "Pregunta en inglés",
        "a".repeat(1001),
        "Pregunta en inglés no puede superar los 1000 caracteres.",
      ],
      ["Pregunta en inglés", "", "Pregunta en inglés no puede quedar vacía."],
      [
        "Opción incorrecta 1 en inglés",
        "",
        "Completá las cuatro opciones en inglés.",
      ],
    ];

    for (const [label, value, message] of cases) {
      updateQuestionMock.mockClear();
      getQuestionEditsMock.mockClear();
      getReportsMock.mockClear();
      const view = render(<Admin />);
      await unlockToPage(user);
      await openEditorFromRow(user);

      fireEvent.change(editorField(label), { target: { value } });
      await saveEditor(user);

      expect(within(editorRegion()).getByRole("alert")).toHaveTextContent(
        message,
      );
      expect(updateQuestionMock).not.toHaveBeenCalled();
      expect(getQuestionEditsMock).toHaveBeenCalledTimes(1);
      expect(getReportsMock).toHaveBeenCalledTimes(1);
      view.unmount();
    }
  });

  it("QORCH-30 a failed history leaves the editor ready, editable and independently retryable", async () => {
    const user = userEvent.setup();
    getQuestionEditsMock
      .mockReset()
      .mockRejectedValueOnce(
        new ApiError("http", "Error del servidor.", { status: 500 }),
      )
      .mockResolvedValueOnce([H_ORDER[0], H_ORDER[1]])
      .mockResolvedValue([H_ORDER[0]]);
    render(<Admin />);
    await unlockToPage(user);
    await openEditorFromRow(user);

    expect(editorField("Pregunta en inglés").value).toBe("Capital of Peru?");
    expect(
      screen.getByRole("button", { name: "Guardar cambios" }),
    ).toBeEnabled();
    const historyAlert = await within(editorRegion()).findByRole("alert");
    expect(historyAlert).toHaveTextContent("No se pudo cargar el historial.");
    expect(historyAlert).toHaveTextContent("Error del servidor.");
    expect(within(editorRegion()).getAllByRole("alert")).toHaveLength(1);

    await user.click(
      within(historyAlert).getByRole("button", {
        name: "Reintentar el historial",
      }),
    );
    await screen.findByText("Campo: Pregunta en inglés");
    expect(getQuestionEditsMock).toHaveBeenCalledTimes(2);
    expect(getQuestionMock).toHaveBeenCalledTimes(1);
    expect(getQuestionEditsMock).toHaveBeenLastCalledWith("clave", 42);
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("heading", { name: "Historial de ediciones" }),
      ),
    );

    fireEvent.change(editorField("Pregunta en inglés"), {
      target: { value: "Capital of Peru (country)?" },
    });
    await saveEditor(user);
    expect(updateQuestionMock).toHaveBeenCalledTimes(1);
    expect(updateQuestionMock).toHaveBeenCalledWith("clave", 42, {
      question: "Capital of Peru (country)?",
    });
  });

  it("QORCH-31 a late history response does not paint over a newer one", async () => {
    const user = userEvent.setup();
    const firstEdits = deferred<AdminQuestionEdit[]>();
    const secondEdits = deferred<AdminQuestionEdit[]>();
    getQuestionEditsMock
      .mockReset()
      .mockReturnValueOnce(firstEdits.promise)
      .mockReturnValueOnce(secondEdits.promise);
    render(<Admin />);
    await unlockToPage(user);
    await openEditorFromRow(user);

    fireEvent.change(editorField("Opción incorrecta 2 en inglés"), {
      target: { value: "Arequipa" },
    });
    await saveEditor(user);
    await waitFor(() => expect(getQuestionEditsMock).toHaveBeenCalledTimes(2));

    await act(async () => {
      secondEdits.resolve([
        {
          id: 21,
          field: "answer",
          old_value: "Lima",
          new_value: "Lima, Perú",
          edited_at: "2026-10-26T18:00:00Z",
        },
      ]);
    });
    expect(await screen.findByText("Campo: Respuesta en inglés")).toBeVisible();

    await act(async () => {
      firstEdits.resolve(H_ORDER);
    });
    await flush();

    expect(screen.getByText("Campo: Respuesta en inglés")).toBeVisible();
    expect(
      screen.queryByText("Campo: Pregunta en inglés"),
    ).not.toBeInTheDocument();
  });

  it("QORCH-32 a new write clears the previous status", async () => {
    const user = userEvent.setup();
    const pendingWrite = deferred<AdminQuestionUpdateResult>();
    updateQuestionMock
      .mockReset()
      .mockResolvedValueOnce(PR_OK)
      .mockReturnValueOnce(pendingWrite.promise);
    render(<Admin />);
    await unlockToPage(user);
    await openEditorFromRow(user);

    fireEvent.change(editorField("Opción incorrecta 2 en inglés"), {
      target: { value: "Arequipa" },
    });
    await saveEditor(user);
    expect(
      await screen.findByText(
        "Campos guardados: Pregunta en inglés, Opción incorrecta 2 en inglés.",
      ),
    ).toBeVisible();

    fireEvent.change(editorField("Opción incorrecta 3 en inglés"), {
      target: { value: "Cusco" },
    });
    await saveEditor(user);

    expect(screen.queryByText(/^Campos guardados:/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardando..." })).toBeVisible();

    await act(async () => {
      pendingWrite.resolve(PR_OK);
    });
    await flush();
    expect(
      screen.getByText(
        "Campos guardados: Pregunta en inglés, Opción incorrecta 2 en inglés.",
      ),
    ).toBeVisible();
  });

  it("QORCH-33 a 503 on save shows the missing-key copy and no reminder", async () => {
    const user = userEvent.setup();
    updateQuestionMock
      .mockReset()
      .mockRejectedValue(
        new ApiError("http", "Error del servidor.", { status: 503 }),
      );
    render(<Admin />);
    await unlockToPage(user);
    await openEditorFromRow(user);

    fireEvent.change(editorField("Opción incorrecta 2 en inglés"), {
      target: { value: "Arequipa" },
    });
    await saveEditor(user);

    const alert = await within(editorRegion()).findByRole("alert");
    expect(alert).toHaveTextContent(
      "La API no tiene la clave de administración configurada.",
    );
    expect(screen.queryByText(/^Campos guardados:/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "Para que esta corrección sobreviva a una recarga de la base, corré: poetry run python -m app.export_admin_edits",
      ),
    ).not.toBeInTheDocument();
  });

  it("QORCH-F1-01 a deferred history survives a 422 save", async () => {
    const user = userEvent.setup();
    const pendingEdits = deferred<AdminQuestionEdit[]>();
    getQuestionEditsMock.mockReset().mockReturnValueOnce(pendingEdits.promise);
    updateQuestionMock.mockReset().mockRejectedValue(
      new ApiError("http", "Los datos enviados no son válidos.", {
        status: 422,
        detail: "…",
      }),
    );
    render(<Admin />);
    await unlockToPage(user);
    await openEditorFromRow(user);
    expect(
      within(editorRegion()).getByText("Cargando historial..."),
    ).toBeVisible();

    fireEvent.change(editorField("Opción incorrecta 2 en inglés"), {
      target: { value: "Arequipa" },
    });
    await saveEditor(user);
    expect(await within(editorRegion()).findByRole("alert")).toHaveTextContent(
      "El cambio no es válido.",
    );

    await act(async () => {
      pendingEdits.resolve([H_ORDER[0], H_ORDER[1]]);
    });

    expect(await screen.findByText("Campo: Pregunta en inglés")).toBeVisible();
    expect(screen.queryByText("Cargando historial...")).not.toBeInTheDocument();
    expect(getQuestionEditsMock).toHaveBeenCalledTimes(1);
  });

  it("QORCH-F1-02 a deferred history that fails still renders its alert after a failed save", async () => {
    const user = userEvent.setup();
    const pendingEdits = deferred<AdminQuestionEdit[]>();
    getQuestionEditsMock.mockReset().mockReturnValueOnce(pendingEdits.promise);
    updateQuestionMock.mockReset().mockRejectedValue(
      new ApiError("http", "Los datos enviados no son válidos.", {
        status: 422,
        detail: "…",
      }),
    );
    render(<Admin />);
    await unlockToPage(user);
    await openEditorFromRow(user);

    fireEvent.change(editorField("Opción incorrecta 2 en inglés"), {
      target: { value: "Arequipa" },
    });
    await saveEditor(user);
    expect(await within(editorRegion()).findByRole("alert")).toHaveTextContent(
      "El cambio no es válido.",
    );

    await act(async () => {
      pendingEdits.reject(
        new ApiError("http", "Error del servidor.", { status: 500 }),
      );
    });

    const historyCopy = await within(editorRegion()).findByText(
      "No se pudo cargar el historial.",
    );
    const historyAlert = historyCopy.closest('[role="alert"]') as HTMLElement;
    expect(historyAlert).toHaveTextContent("Error del servidor.");
    expect(
      screen.getByRole("button", { name: "Reintentar el historial" }),
    ).toBeVisible();
    expect(getQuestionEditsMock).toHaveBeenCalledTimes(1);
  });

  it("QORCH-F1-03 a deferred history survives a failed hide", async () => {
    const user = userEvent.setup();
    const pendingEdits = deferred<AdminQuestionEdit[]>();
    getQuestionEditsMock.mockReset().mockReturnValueOnce(pendingEdits.promise);
    hideQuestionMock
      .mockReset()
      .mockRejectedValue(new ApiError("network", "Sin conexión."));
    render(<Admin />);
    await unlockToPage(user);
    await openEditorFromRow(user);

    await user.click(screen.getByRole("button", { name: "Ocultar pregunta" }));
    await user.click(screen.getByRole("button", { name: "Confirmar ocultar" }));
    expect(await within(editorRegion()).findByRole("alert")).toHaveTextContent(
      "¿Está corriendo la API?",
    );

    await act(async () => {
      pendingEdits.resolve([H_ORDER[0], H_ORDER[1]]);
    });

    expect(await screen.findByText("Campo: Pregunta en inglés")).toBeVisible();
    expect(screen.queryByText("Cargando historial...")).not.toBeInTheDocument();
    expect(getQuestionEditsMock).toHaveBeenCalledTimes(1);
  });

  it("QORCH-F1-04 a deferred history survives a failed restore", async () => {
    const user = userEvent.setup();
    const pendingEdits = deferred<AdminQuestionEdit[]>();
    getQuestionMock.mockReset().mockResolvedValue(F_Q43);
    getQuestionEditsMock.mockReset().mockReturnValueOnce(pendingEdits.promise);
    updateQuestionMock
      .mockReset()
      .mockRejectedValue(
        new ApiError("http", "Error del servidor.", { status: 500 }),
      );
    render(<Admin />);
    await unlockToPage(user);
    await openEditorByNumber(user, 43);

    await user.click(screen.getByRole("button", { name: "Volver a mostrar" }));
    expect(
      await within(editorRegion(43)).findByRole("alert"),
    ).toHaveTextContent("Error del servidor.");

    await act(async () => {
      pendingEdits.resolve([H_ORDER[0], H_ORDER[1]]);
    });

    expect(await screen.findByText("Campo: Pregunta en inglés")).toBeVisible();
    expect(screen.queryByText("Cargando historial...")).not.toBeInTheDocument();
    expect(getQuestionEditsMock).toHaveBeenCalledTimes(1);
  });

  it("QORCH-F1-05 a successful save supersedes the pending history", async () => {
    const user = userEvent.setup();
    const pendingEdits = deferred<AdminQuestionEdit[]>();
    const refreshed = {
      id: 21,
      field: "answer",
      old_value: "Lima",
      new_value: "Lima, Perú",
      edited_at: "2026-10-26T18:00:00Z",
    };
    getQuestionEditsMock
      .mockReset()
      .mockReturnValueOnce(pendingEdits.promise)
      .mockResolvedValueOnce([refreshed]);
    render(<Admin />);
    await unlockToPage(user);
    await openEditorFromRow(user);

    fireEvent.change(editorField("Opción incorrecta 2 en inglés"), {
      target: { value: "Arequipa" },
    });
    await saveEditor(user);
    await screen.findByText(/^Campos guardados:/);

    expect(await screen.findByText("Campo: Respuesta en inglés")).toBeVisible();
    await act(async () => {
      pendingEdits.resolve(H_ORDER);
    });
    await flush();

    expect(screen.getByText("Campo: Respuesta en inglés")).toBeVisible();
    expect(
      screen.queryByText("Campo: Pregunta en inglés"),
    ).not.toBeInTheDocument();
    expect(getQuestionEditsMock).toHaveBeenCalledTimes(2);
  });
});
