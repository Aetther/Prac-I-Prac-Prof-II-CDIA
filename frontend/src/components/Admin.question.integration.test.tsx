import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
  AdminQuestion,
  AdminQuestionUpdateResult,
  AdminReport,
  ReportStats,
} from "../api/types";
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

const F_Q42_ESDUP: AdminQuestion = {
  ...F_Q42,
  answer_es: "París",
};

const F_QHTML: AdminQuestion = {
  ...F_Q42,
  question: "<b>Capital</b> of Peru?",
  wrong_1: "<i>Quito</i>",
};

const PR_OK: AdminQuestionUpdateResult = {
  changed_fields: ["wrong_2"],
  question: { ...F_Q42, wrong_2: "Arequipa" },
};

const H_ORDER = [
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

const S_MIX: ReportStats = {
  pendiente: 3,
  resuelto: 1,
  descartado: 0,
  pending_by_reason: { otro: 1, traduccion: 2 },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;

function installFetch(handler: Handler) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
      handler(String(input), init ?? {}),
    ),
  );
}

function fetchMock(): ReturnType<typeof vi.fn> {
  return globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
}

function callsMatching(fragment: string) {
  return fetchMock().mock.calls.filter(([url]) =>
    String(url).includes(fragment),
  );
}

const questionCalls = (id = 42) =>
  fetchMock().mock.calls.filter(([url]) =>
    String(url).endsWith(`/questions/${id}`),
  );
const editsCalls = (id = 42) =>
  fetchMock().mock.calls.filter(([url]) =>
    String(url).endsWith(`/questions/${id}/edits`),
  );
const patchCalls = (id = 42) =>
  questionCalls(id).filter(
    ([, init]) => (init as RequestInit).method === "PATCH",
  );
const deleteCalls = (id = 42) =>
  questionCalls(id).filter(
    ([, init]) => (init as RequestInit).method === "DELETE",
  );
const listCalls = () => callsMatching("/reports?");

async function unlock(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Clave de administración"), "clave");
  await user.click(screen.getByRole("button", { name: "Ingresar" }));
  await screen.findByRole("heading", { name: "Reportes" });
}

async function openRow(
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

function editorRegion(questionId = 42): HTMLElement {
  return screen.getByRole("region", {
    name: `Editar pregunta ${questionId}`,
  });
}

function field(label: string): HTMLInputElement {
  return screen.getByLabelText(label) as HTMLInputElement;
}

beforeEach(() => {
  vi.stubEnv("VITE_API_URL", "http://localhost:8000");
});

afterEach(() => {
  window.history.pushState({}, "", "/");
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Admin question editing through the real API client", () => {
  it("QINT-01 opening question 42 sends exactly GET /questions/42 and GET /questions/42/edits", async () => {
    const user = userEvent.setup();
    const editsResponse = deferred<Response>();
    installFetch((url, init) => {
      if (url.endsWith("/reports/stats")) return jsonResponse(S_MIX);
      if (url.includes("/reports?")) return jsonResponse([F_PEN]);
      if (url.endsWith("/questions/42/edits")) return editsResponse.promise;
      if (url.endsWith("/questions/42")) return jsonResponse(F_Q42);
      throw new Error(`unexpected ${url} ${init.method}`);
    });
    render(<Admin />);
    await unlock(user);
    await screen.findByText("Reporte 7");
    await openRow(user);

    await waitFor(() =>
      expect(field("Opción incorrecta 1 en inglés").value).toBe("Quito"),
    );
    expect(field("Opción incorrecta 2 en inglés").value).toBe("Bogotá");
    expect(field("Opción incorrecta 3 en inglés").value).toBe("Santiago");
    expect(
      within(editorRegion()).getByText("Cargando historial..."),
    ).toBeVisible();

    expect(questionCalls()).toHaveLength(1);
    const [url, init] = questionCalls()[0] as [string, RequestInit];
    expect(String(url)).toBe("http://localhost:8000/questions/42");
    expect(init.method).toBe("GET");
    expect(init.headers).toEqual({ "X-API-Key": "clave" });
    expect(init.body).toBeUndefined();
    expect(String(url)).not.toContain("clave");

    expect(editsCalls()).toHaveLength(1);
    const [editsUrl, editsInit] = editsCalls()[0] as [string, RequestInit];
    expect(String(editsUrl)).toBe("http://localhost:8000/questions/42/edits");
    expect(editsInit.headers).toEqual({ "X-API-Key": "clave" });

    editsResponse.resolve(jsonResponse([]));
    expect(await screen.findByText("Sin ediciones registradas.")).toBeVisible();
  });

  it("QINT-02 a save sends exactly PATCH /questions/42 with the trimmed body, then two refetches", async () => {
    const user = userEvent.setup();
    installFetch((url, init) => {
      if (url.endsWith("/reports/stats")) return jsonResponse(S_MIX);
      if (url.includes("/reports?")) return jsonResponse([F_PEN]);
      if (url.endsWith("/questions/42/edits")) return jsonResponse(H_ORDER);
      if (url.endsWith("/questions/42") && init.method === "PATCH") {
        return jsonResponse(PR_OK);
      }
      if (url.endsWith("/questions/42")) return jsonResponse(F_Q42);
      throw new Error(`unexpected ${url} ${init.method}`);
    });
    render(<Admin />);
    await unlock(user);
    await screen.findByText("Reporte 7");
    await openRow(user);

    fireEvent.change(field("Opción incorrecta 2 en inglés"), {
      target: { value: "  Arequipa  " },
    });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await screen.findByText("Campos guardados: Opción incorrecta 2 en inglés.");

    expect(patchCalls()).toHaveLength(1);
    const [url, init] = patchCalls()[0] as [string, RequestInit];
    expect(String(url)).toBe("http://localhost:8000/questions/42");
    expect(init.method).toBe("PATCH");
    expect(init.headers).toEqual({
      "X-API-Key": "clave",
      "Content-Type": "application/json",
    });
    expect(String(init.body)).toBe('{"wrong_2":"Arequipa"}');
    expect(editsCalls()).toHaveLength(2);
    expect(listCalls()).toHaveLength(2);
    expect(String(listCalls()[1][0])).toBe(
      "http://localhost:8000/reports?status=pendiente&skip=0&limit=20",
    );
    expect(
      screen.getByText(
        "Para que esta corrección sobreviva a una recarga de la base, corré: poetry run python -m app.export_admin_edits",
      ),
    ).toBeVisible();
  });

  it("QINT-03 a hide sends exactly DELETE /questions/42 with no body, then two refetches", async () => {
    const user = userEvent.setup();
    installFetch((url, init) => {
      if (url.endsWith("/reports/stats")) return jsonResponse(S_MIX);
      if (url.includes("/reports?")) return jsonResponse([F_PEN]);
      if (url.endsWith("/questions/42/edits")) return jsonResponse(H_ORDER);
      if (url.endsWith("/questions/42") && init.method === "DELETE") {
        return jsonResponse({ id: 42, is_active: false });
      }
      if (url.endsWith("/questions/42")) return jsonResponse(F_Q42);
      throw new Error(`unexpected ${url} ${init.method}`);
    });
    render(<Admin />);
    await unlock(user);
    await screen.findByText("Reporte 7");
    await openRow(user);

    await user.click(screen.getByRole("button", { name: "Ocultar pregunta" }));
    await user.click(screen.getByRole("button", { name: "Confirmar ocultar" }));
    await screen.findByText("Pregunta oculta.");

    expect(deleteCalls()).toHaveLength(1);
    const [url, init] = deleteCalls()[0] as [string, RequestInit];
    expect(String(url)).toBe("http://localhost:8000/questions/42");
    expect(init.headers).toEqual({ "X-API-Key": "clave" });
    expect(init.body).toBeUndefined();
    expect(editsCalls()).toHaveLength(2);
    expect(listCalls()).toHaveLength(2);
    expect(screen.getByText("Oculta")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Volver a mostrar" }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Para que esta corrección sobreviva a una recarga de la base, corré: poetry run python -m app.export_admin_edits",
      ),
    ).toBeVisible();
  });

  it('QINT-04 a restore sends exactly PATCH /questions/42 with {"is_active":true}', async () => {
    const user = userEvent.setup();
    installFetch((url, init) => {
      if (url.endsWith("/reports/stats")) return jsonResponse(S_MIX);
      if (url.includes("/reports?")) return jsonResponse([F_PEN]);
      if (url.endsWith("/questions/42/edits")) return jsonResponse(H_ORDER);
      if (url.endsWith("/questions/42") && init.method === "PATCH") {
        return jsonResponse({
          changed_fields: ["is_active"],
          question: { ...F_Q42, is_active: true },
        });
      }
      if (url.endsWith("/questions/42")) {
        return jsonResponse({ ...F_Q42, is_active: false });
      }
      throw new Error(`unexpected ${url} ${init.method}`);
    });
    render(<Admin />);
    await unlock(user);
    await screen.findByText("Reporte 7");
    await openRow(user);

    await user.click(screen.getByRole("button", { name: "Volver a mostrar" }));
    await screen.findByText("Pregunta visible de nuevo.");

    expect(patchCalls()).toHaveLength(1);
    const [url, init] = patchCalls()[0] as [string, RequestInit];
    expect(String(url)).toBe("http://localhost:8000/questions/42");
    expect(init.headers).toEqual({
      "X-API-Key": "clave",
      "Content-Type": "application/json",
    });
    expect(String(init.body)).toBe('{"is_active":true}');
    expect(editsCalls()).toHaveLength(2);
    expect(listCalls()).toHaveLength(2);
  });

  it("QINT-05 a real 404 on save closes the editor with La pregunta ya no existe.", async () => {
    const user = userEvent.setup();
    installFetch((url, init) => {
      if (url.endsWith("/reports/stats")) return jsonResponse(S_MIX);
      if (url.includes("/reports?")) return jsonResponse([F_PEN]);
      if (url.endsWith("/questions/42/edits")) return jsonResponse(H_ORDER);
      if (url.endsWith("/questions/42") && init.method === "PATCH") {
        return jsonResponse({ detail: "Question not found" }, 404);
      }
      if (url.endsWith("/questions/42")) return jsonResponse(F_Q42);
      throw new Error(`unexpected ${url} ${init.method}`);
    });
    render(<Admin />);
    await unlock(user);
    await screen.findByText("Reporte 7");
    await openRow(user);

    fireEvent.change(field("Opción incorrecta 2 en inglés"), {
      target: { value: "Arequipa" },
    });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("La pregunta ya no existe.");
    expect(
      screen.queryByRole("region", { name: "Editar pregunta 42" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Reintentar" }),
    ).not.toBeInTheDocument();
  });

  it("QINT-06 a real 422 with a Pydantic list renders El cambio no es válido. and the joined msg", async () => {
    const user = userEvent.setup();
    installFetch((url, init) => {
      if (url.endsWith("/reports/stats")) return jsonResponse(S_MIX);
      if (url.includes("/reports?")) return jsonResponse([F_PEN]);
      if (url.endsWith("/questions/42/edits")) return jsonResponse(H_ORDER);
      if (url.endsWith("/questions/42") && init.method === "PATCH") {
        return jsonResponse(
          {
            detail: [
              {
                loc: ["body", "wrong_2"],
                msg: "las opciones deben ser distintas",
              },
            ],
          },
          422,
        );
      }
      if (url.endsWith("/questions/42")) return jsonResponse(F_Q42);
      throw new Error(`unexpected ${url} ${init.method}`);
    });
    render(<Admin />);
    await unlock(user);
    await screen.findByText("Reporte 7");
    await openRow(user);

    fireEvent.change(field("Opción incorrecta 2 en inglés"), {
      target: { value: "Arequipa" },
    });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    const alert = await within(editorRegion()).findByRole("alert");
    expect(alert).toHaveTextContent("El cambio no es válido.");
    expect(alert).toHaveTextContent("las opciones deben ser distintas");
    expect(
      within(editorRegion()).queryByRole("button", { name: "Reintentar" }),
    ).not.toBeInTheDocument();
    expect(field("Opción incorrecta 2 en inglés").value).toBe("Arequipa");
  });

  it("QINT-07 a 200 missing wrong_1 shows Respuesta inválida del servidor. with primera opción incorrecta inválida", async () => {
    const user = userEvent.setup();
    const missingWrong1: Record<string, unknown> = { ...F_Q42 };
    delete missingWrong1.wrong_1;
    installFetch((url, init) => {
      if (url.endsWith("/reports/stats")) return jsonResponse(S_MIX);
      if (url.includes("/reports?")) return jsonResponse([F_PEN]);
      if (url.endsWith("/questions/42/edits")) return jsonResponse(H_ORDER);
      if (url.endsWith("/questions/42")) return jsonResponse(missingWrong1);
      throw new Error(`unexpected ${url} ${init.method}`);
    });
    render(<Admin />);
    await unlock(user);
    await screen.findByText("Reporte 7");

    await user.click(
      screen.getByRole("button", { name: "Abrir la pregunta 42" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Editar pregunta 42" }),
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Respuesta inválida del servidor.");
    expect(alert).toHaveTextContent("primera opción incorrecta inválida");
    expect(
      screen.queryByRole("region", { name: "Editar pregunta 42" }),
    ).not.toBeInTheDocument();
  });

  it("QINT-08 the history renders in the response order with the Buenos Aires literals and raw is_active strings", async () => {
    const user = userEvent.setup();
    installFetch((url, init) => {
      if (url.endsWith("/reports/stats")) return jsonResponse(S_MIX);
      if (url.includes("/reports?")) return jsonResponse([F_PEN]);
      if (url.endsWith("/questions/42/edits")) return jsonResponse(H_ORDER);
      if (url.endsWith("/questions/42")) return jsonResponse(F_Q42);
      throw new Error(`unexpected ${url} ${init.method}`);
    });
    render(<Admin />);
    await unlock(user);
    await screen.findByText("Reporte 7");
    await openRow(user);

    const list = await within(editorRegion()).findByRole("list");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Campo: Pregunta en inglés");
    expect(items[1]).toHaveTextContent("Campo: Visibilidad");
    expect(items[2]).toHaveTextContent("Campo: foo");
    expect(items[1]).toHaveTextContent("Antes: false");
    expect(items[1]).toHaveTextContent("Después: true");
    expect(items[1]).not.toHaveTextContent("Visible");
    expect(items[1]).not.toHaveTextContent("Oculta");

    const first = within(list).getByText("26/10/26, 9:00 a. m.");
    expect(first.tagName).toBe("TIME");
    expect(first).toHaveAttribute("datetime", "2026-10-26T12:00:00Z");
    expect(within(list).getByText("26/10/26, 10:00 a. m.")).toBeVisible();
    expect(within(list).getByText("26/10/26, 11:00 a. m.")).toBeVisible();
  });

  it("QINT-09 the page refetch after a save keeps the applied status filter", async () => {
    const user = userEvent.setup();
    installFetch((url, init) => {
      if (url.endsWith("/reports/stats")) return jsonResponse(S_MIX);
      if (url.includes("/reports?")) return jsonResponse([F_PEN]);
      if (url.endsWith("/questions/42/edits")) return jsonResponse(H_ORDER);
      if (url.endsWith("/questions/42") && init.method === "PATCH") {
        return jsonResponse(PR_OK);
      }
      if (url.endsWith("/questions/42")) return jsonResponse(F_Q42);
      throw new Error(`unexpected ${url} ${init.method}`);
    });
    render(<Admin />);
    await unlock(user);
    await screen.findByText("Reporte 7");
    await user.selectOptions(screen.getByLabelText("Estado"), "descartado");
    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await screen.findByText("Reporte 7");
    await openRow(user);

    fireEvent.change(field("Opción incorrecta 2 en inglés"), {
      target: { value: "Arequipa" },
    });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await screen.findByText(/^Campos guardados:/);

    expect(String(listCalls().at(-1)?.[0])).toBe(
      "http://localhost:8000/reports?status=descartado&skip=0&limit=20",
    );
  });

  it("QINT-10 a question containing HTML renders as characters through the real client", async () => {
    const user = userEvent.setup();
    installFetch((url, init) => {
      if (url.endsWith("/reports/stats")) return jsonResponse(S_MIX);
      if (url.includes("/reports?")) return jsonResponse([F_PEN]);
      if (url.endsWith("/questions/42/edits")) return jsonResponse(H_ORDER);
      if (url.endsWith("/questions/42")) return jsonResponse(F_QHTML);
      throw new Error(`unexpected ${url} ${init.method}`);
    });
    render(<Admin />);
    await unlock(user);
    await screen.findByText("Reporte 7");
    await openRow(user);

    expect(field("Pregunta en inglés").value).toBe("<b>Capital</b> of Peru?");
    expect(field("Opción incorrecta 1 en inglés").value).toBe("<i>Quito</i>");
    expect(editorRegion().querySelector("b")).toBeNull();
    expect(editorRegion().querySelector("i")).toBeNull();
  });

  it("QINT-11 the report entry keeps the region open and loads the editor below the panel", async () => {
    const user = userEvent.setup();
    installFetch((url, init) => {
      if (url.endsWith("/reports/stats")) return jsonResponse(S_MIX);
      if (url.includes("/reports?")) return jsonResponse([F_PEN]);
      if (url.endsWith("/questions/42/edits")) return jsonResponse(H_ORDER);
      if (url.endsWith("/questions/42")) return jsonResponse(F_Q42);
      throw new Error(`unexpected ${url} ${init.method}`);
    });
    window.history.pushState({}, "", "/admin");
    render(<Admin />);
    await unlock(user);
    await screen.findByText("Reporte 7");
    await openRow(user);

    const rowRegion = screen.getByRole("region", { name: "Pregunta 42" });
    expect(rowRegion).toBeVisible();
    expect(within(rowRegion).getByText("Capital of Peru?")).toBeVisible();
    expect(within(rowRegion).getByText("¿Capital del Perú?")).toBeVisible();
    const panel = screen.getByRole("heading", { name: "Reportes" });
    const editor = editorRegion();
    expect(
      panel.compareDocumentPosition(editor) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(window.location.pathname).toBe("/admin");
  });

  it("QINT-12 an untranslated question sends the five Spanish fields together", async () => {
    const user = userEvent.setup();
    installFetch((url, init) => {
      if (url.endsWith("/reports/stats")) return jsonResponse(S_MIX);
      if (url.includes("/reports?")) return jsonResponse([F_PEN]);
      if (url.endsWith("/questions/43/edits")) return jsonResponse([]);
      if (url.endsWith("/questions/43") && init.method === "PATCH") {
        return jsonResponse({
          changed_fields: [
            "question_es",
            "answer_es",
            "wrong_1_es",
            "wrong_2_es",
            "wrong_3_es",
          ],
          question: {
            ...F_Q43,
            question_es: "¿Capital del Ecuador?",
            answer_es: "Quito",
            wrong_1_es: "Guayaquil",
            wrong_2_es: "Cuenca",
            wrong_3_es: "Loja",
            is_translated: true,
          },
        });
      }
      if (url.endsWith("/questions/43")) return jsonResponse(F_Q43);
      throw new Error(`unexpected ${url} ${init.method}`);
    });
    render(<Admin />);
    await unlock(user);
    await screen.findByText("Reporte 7");

    await user.type(screen.getByLabelText("Pregunta"), "43");
    await user.click(screen.getByRole("button", { name: "Abrir editor" }));
    await screen.findByRole("region", { name: "Editar pregunta 43" });

    fireEvent.change(field("Pregunta en español"), {
      target: { value: "¿Capital del Ecuador?" },
    });
    fireEvent.change(field("Respuesta en español"), {
      target: { value: "Quito" },
    });
    fireEvent.change(field("Opción incorrecta 1 en español"), {
      target: { value: "Guayaquil" },
    });
    fireEvent.change(field("Opción incorrecta 2 en español"), {
      target: { value: "Cuenca" },
    });
    fireEvent.change(field("Opción incorrecta 3 en español"), {
      target: { value: "Loja" },
    });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await screen.findByText(/^Campos guardados:/);

    expect(patchCalls(43)).toHaveLength(1);
    const body = JSON.parse(
      String((patchCalls(43)[0][1] as RequestInit).body),
    ) as Record<string, unknown>;
    expect(Object.keys(body)).toEqual([
      "question_es",
      "answer_es",
      "wrong_1_es",
      "wrong_2_es",
      "wrong_3_es",
    ]);
  });

  it("QINT-13 a translated question sends one Spanish field", async () => {
    const user = userEvent.setup();
    installFetch((url, init) => {
      if (url.endsWith("/reports/stats")) return jsonResponse(S_MIX);
      if (url.includes("/reports?")) return jsonResponse([F_PEN]);
      if (url.endsWith("/questions/42/edits")) return jsonResponse(H_ORDER);
      if (url.endsWith("/questions/42") && init.method === "PATCH") {
        return jsonResponse({
          changed_fields: ["answer_es"],
          question: { ...F_Q42, answer_es: "Lima, Perú" },
        });
      }
      if (url.endsWith("/questions/42")) return jsonResponse(F_Q42);
      throw new Error(`unexpected ${url} ${init.method}`);
    });
    render(<Admin />);
    await unlock(user);
    await screen.findByText("Reporte 7");
    await openRow(user);

    fireEvent.change(field("Respuesta en español"), {
      target: { value: "Lima, Perú" },
    });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await screen.findByText(/^Campos guardados:/);

    expect(patchCalls()).toHaveLength(1);
    expect(String((patchCalls()[0][1] as RequestInit).body)).toBe(
      '{"answer_es":"Lima, Perú"}',
    );
  });

  it("QINT-14 a save on a hidden question sends only the text key", async () => {
    const user = userEvent.setup();
    installFetch((url, init) => {
      if (url.endsWith("/reports/stats")) return jsonResponse(S_MIX);
      if (url.includes("/reports?")) return jsonResponse([F_PEN]);
      if (url.endsWith("/questions/43/edits")) return jsonResponse([]);
      if (url.endsWith("/questions/43") && init.method === "PATCH") {
        return jsonResponse({
          changed_fields: ["question"],
          question: {
            ...F_Q43,
            question: "Capital of Ecuador (country)?",
          },
        });
      }
      if (url.endsWith("/questions/43")) return jsonResponse(F_Q43);
      throw new Error(`unexpected ${url} ${init.method}`);
    });
    render(<Admin />);
    await unlock(user);
    await screen.findByText("Reporte 7");

    await user.type(screen.getByLabelText("Pregunta"), "43");
    await user.click(screen.getByRole("button", { name: "Abrir editor" }));
    await screen.findByRole("region", { name: "Editar pregunta 43" });

    fireEvent.change(field("Pregunta en inglés"), {
      target: { value: "Capital of Ecuador (country)?" },
    });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await screen.findByText(/^Campos guardados:/);

    expect(patchCalls(43)).toHaveLength(1);
    expect(String((patchCalls(43)[0][1] as RequestInit).body)).toBe(
      '{"question":"Capital of Ecuador (country)?"}',
    );
    expect(screen.getByText("Oculta")).toBeVisible();
  });

  it("QINT-15 a real 401 on an editor request returns to the gate", async () => {
    const user = userEvent.setup();
    installFetch((url, init) => {
      if (url.endsWith("/reports/stats")) return jsonResponse(S_MIX);
      if (url.includes("/reports?")) return jsonResponse([F_PEN]);
      if (url.endsWith("/questions/42/edits")) return jsonResponse(H_ORDER);
      if (url.endsWith("/questions/42") && init.method === "PATCH") {
        return jsonResponse({ detail: "Invalid API key" }, 401);
      }
      if (url.endsWith("/questions/42")) return jsonResponse(F_Q42);
      throw new Error(`unexpected ${url} ${init.method}`);
    });
    render(<Admin />);
    await unlock(user);
    await screen.findByText("Reporte 7");
    await openRow(user);

    fireEvent.change(field("Opción incorrecta 2 en inglés"), {
      target: { value: "Arequipa" },
    });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "La clave dejó de ser válida. Volvé a ingresar la clave.",
      ),
    );
    expect(
      screen.queryByRole("region", { name: "Editar pregunta 42" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Pregunta en inglés"),
    ).not.toBeInTheDocument();
  });

  it("QINT-16 a real 503 on the question keeps the editor closed and retries both", async () => {
    const user = userEvent.setup();
    let questionCount = 0;
    installFetch((url, init) => {
      if (url.endsWith("/reports/stats")) return jsonResponse(S_MIX);
      if (url.includes("/reports?")) return jsonResponse([F_PEN]);
      if (url.endsWith("/questions/42/edits")) return jsonResponse(H_ORDER);
      if (url.endsWith("/questions/42")) {
        questionCount += 1;
        return questionCount === 1
          ? jsonResponse({ detail: "No API_KEY" }, 503)
          : jsonResponse(F_Q42);
      }
      throw new Error(`unexpected ${url} ${init.method}`);
    });
    render(<Admin />);
    await unlock(user);
    await screen.findByText("Reporte 7");

    await user.click(
      screen.getByRole("button", { name: "Abrir la pregunta 42" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Editar pregunta 42" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "La API no tiene la clave de administración configurada.",
    );

    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    await screen.findByRole("region", { name: "Editar pregunta 42" });
    expect(questionCalls()).toHaveLength(2);
    expect(editsCalls()).toHaveLength(2);
  });

  it("QINT-17 a real 500 on the history leaves the editor ready and retries only the edits", async () => {
    const user = userEvent.setup();
    let editsCount = 0;
    installFetch((url, init) => {
      if (url.endsWith("/reports/stats")) return jsonResponse(S_MIX);
      if (url.includes("/reports?")) return jsonResponse([F_PEN]);
      if (url.endsWith("/questions/42/edits")) {
        editsCount += 1;
        return editsCount === 1
          ? jsonResponse({ detail: "boom" }, 500)
          : jsonResponse(H_ORDER);
      }
      if (url.endsWith("/questions/42") && init.method === "PATCH") {
        return jsonResponse(PR_OK);
      }
      if (url.endsWith("/questions/42")) return jsonResponse(F_Q42);
      throw new Error(`unexpected ${url} ${init.method}`);
    });
    render(<Admin />);
    await unlock(user);
    await screen.findByText("Reporte 7");
    await openRow(user);

    const historyAlert = await within(editorRegion()).findByRole("alert");
    expect(historyAlert).toHaveTextContent("No se pudo cargar el historial.");
    expect(historyAlert).toHaveTextContent("Error del servidor.");
    expect(
      screen.getByRole("button", { name: "Guardar cambios" }),
    ).toBeEnabled();
    expect(questionCalls()).toHaveLength(1);

    await user.click(
      within(editorRegion()).getByRole("button", {
        name: "Reintentar el historial",
      }),
    );
    await screen.findByText("Campo: Pregunta en inglés");
    expect(editsCalls()).toHaveLength(2);
    expect(questionCalls()).toHaveLength(1);

    fireEvent.change(field("Opción incorrecta 2 en inglés"), {
      target: { value: "Arequipa" },
    });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await screen.findByText(/^Campos guardados:/);
    expect(patchCalls()).toHaveLength(1);
  });

  it("QINT-18 a loaded null Spanish option blocks the PATCH before fetch", async () => {
    const user = userEvent.setup();
    installFetch((url, init) => {
      if (url.endsWith("/reports/stats")) return jsonResponse(S_MIX);
      if (url.includes("/reports?")) return jsonResponse([F_PEN]);
      if (url.endsWith("/questions/43/edits")) return jsonResponse([]);
      if (url.endsWith("/questions/43")) return jsonResponse(F_Q43);
      throw new Error(`unexpected ${url} ${init.method}`);
    });
    render(<Admin />);
    await unlock(user);
    await screen.findByText("Reporte 7");

    await user.type(screen.getByLabelText("Pregunta"), "43");
    await user.click(screen.getByRole("button", { name: "Abrir editor" }));
    await screen.findByRole("region", { name: "Editar pregunta 43" });

    fireEvent.change(field("Pregunta en español"), {
      target: { value: "¿Capital del Ecuador?" },
    });
    fireEvent.change(field("Respuesta en español"), {
      target: { value: "Quito" },
    });
    fireEvent.change(field("Opción incorrecta 1 en español"), {
      target: { value: "Guayaquil" },
    });
    fireEvent.change(field("Opción incorrecta 2 en español"), {
      target: { value: "Cuenca" },
    });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(within(editorRegion(43)).getByRole("alert")).toHaveTextContent(
      "Completá las cuatro opciones en español.",
    );
    expect(patchCalls(43)).toHaveLength(0);
  });

  it("QINT-19 a case-insensitive duplicate blocks the PATCH before fetch", async () => {
    const user = userEvent.setup();
    installFetch((url, init) => {
      if (url.endsWith("/reports/stats")) return jsonResponse(S_MIX);
      if (url.includes("/reports?")) return jsonResponse([F_PEN]);
      if (url.endsWith("/questions/42/edits")) return jsonResponse(H_ORDER);
      if (url.endsWith("/questions/42")) return jsonResponse(F_Q42_ESDUP);
      throw new Error(`unexpected ${url} ${init.method}`);
    });
    render(<Admin />);
    await unlock(user);
    await screen.findByText("Reporte 7");
    await openRow(user);

    fireEvent.change(field("Opción incorrecta 1 en español"), {
      target: { value: "parís" },
    });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(within(editorRegion()).getByRole("alert")).toHaveTextContent(
      "Las cuatro opciones en español tienen que ser distintas entre sí.",
    );
    expect(patchCalls()).toHaveLength(0);
  });
});
