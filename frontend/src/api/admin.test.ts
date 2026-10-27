import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ADMIN_REPORT_LANG_LABELS,
  ADMIN_REPORT_PAGE_SIZE,
  ADMIN_STATUS_FILTER_OPTIONS,
  ADMIN_STATUS_LABELS,
  getReports,
  getReportStats,
  updateReportStatus,
} from "./admin";
import type { ReportListParams } from "./admin";
import type { AdminReportStatusFilter } from "./types";

const statsBody = {
  pendiente: 3,
  resuelto: 1,
  descartado: 0,
  pending_by_reason: { traduccion: 2, otro: 1 },
};

const reportBody = {
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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function fetchMock(): ReturnType<typeof vi.fn> {
  return globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
}

function call(index = 0): [string, RequestInit] {
  const [url, init] = fetchMock().mock.calls[index] as [string, RequestInit];
  return [String(url), init];
}

describe("admin API client", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("VITE_API_URL", "http://localhost:8000");
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(statsBody));
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it("API-01 getReportStats sends GET /reports/stats with only X-API-Key", async () => {
    const stats = await getReportStats("clave");

    expect(stats).toEqual(statsBody);
    expect(fetchMock()).toHaveBeenCalledTimes(1);
    const [url, init] = call();
    expect(url).toBe("http://localhost:8000/reports/stats");
    expect(init.method).toBe("GET");
    expect(init.headers).toEqual({ "X-API-Key": "clave" });
    expect(init.body).toBeUndefined();
    expect(url).not.toContain("clave");

    const unknown = {
      pendiente: 6,
      resuelto: 0,
      descartado: 0,
      pending_by_reason: { duplicada: 2, zombi: 3 },
    };
    fetchMock().mockResolvedValueOnce(jsonResponse(unknown));
    await expect(getReportStats("clave")).resolves.toEqual(unknown);
    expect(fetchMock()).toHaveBeenCalledTimes(2);
  });

  it("API-02 getReports sends the default URL with no question_id", async () => {
    fetchMock().mockResolvedValueOnce(jsonResponse([reportBody]));

    const reports = await getReports("clave", {
      status: "pendiente",
      skip: 0,
      limit: 20,
    });

    expect(reports).toEqual([reportBody]);
    expect(fetchMock()).toHaveBeenCalledTimes(1);
    const [url, init] = call();
    expect(url).toBe(
      "http://localhost:8000/reports?status=pendiente&skip=0&limit=20",
    );
    expect(init.method).toBe("GET");
    expect(init.headers).toEqual({ "X-API-Key": "clave" });
    expect(init.body).toBeUndefined();
    expect(url).not.toContain("question_id");
  });

  it("API-03 getReports appends question_id last for a positive integer", async () => {
    fetchMock().mockResolvedValueOnce(jsonResponse([reportBody]));

    await getReports("clave", {
      status: "pendiente",
      questionId: 42,
      skip: 0,
      limit: 20,
    });

    const [url] = call();
    expect(url).toBe(
      "http://localhost:8000/reports?status=pendiente&skip=0&limit=20&question_id=42",
    );
    expect(url.indexOf("question_id")).toBeGreaterThan(url.indexOf("limit=20"));
    expect(fetchMock()).toHaveBeenCalledTimes(1);
  });

  it("API-04 getReports omits question_id for null and undefined", async () => {
    fetchMock()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]));

    await getReports("clave", {
      status: "pendiente",
      questionId: null,
      skip: 0,
      limit: 20,
    });
    await getReports("clave", { status: "pendiente", skip: 0, limit: 20 });

    for (const index of [0, 1]) {
      const [url] = call(index);
      expect(url).toBe(
        "http://localhost:8000/reports?status=pendiente&skip=0&limit=20",
      );
      expect(url).not.toContain("question_id");
    }
    expect(fetchMock()).toHaveBeenCalledTimes(2);
  });

  it("API-05 getReports accepts skip 0/20 and limit 1/20/100", async () => {
    fetchMock().mockImplementation(() => Promise.resolve(jsonResponse([])));
    const cases: ReportListParams[] = [
      { status: "pendiente", skip: 0, limit: 1 },
      { status: "pendiente", skip: 0, limit: 20 },
      { status: "pendiente", skip: 0, limit: 100 },
      { status: "resuelto", skip: 20, limit: 20 },
      { status: "todos", skip: 20, limit: 100 },
    ];

    for (const params of cases) {
      await expect(getReports("clave", params)).resolves.toEqual([]);
    }

    expect(fetchMock()).toHaveBeenCalledTimes(cases.length);
    expect(call(0)[0]).toBe(
      "http://localhost:8000/reports?status=pendiente&skip=0&limit=1",
    );
    expect(call(1)[0]).toBe(
      "http://localhost:8000/reports?status=pendiente&skip=0&limit=20",
    );
    expect(call(2)[0]).toBe(
      "http://localhost:8000/reports?status=pendiente&skip=0&limit=100",
    );
    expect(call(3)[0]).toBe(
      "http://localhost:8000/reports?status=resuelto&skip=20&limit=20",
    );
    expect(call(4)[0]).toBe(
      "http://localhost:8000/reports?status=todos&skip=20&limit=100",
    );
  });

  it("API-06 updateReportStatus sends the exact PATCH for each status", async () => {
    for (const status of ["resuelto", "descartado", "pendiente"] as const) {
      fetchMock().mockResolvedValueOnce(
        jsonResponse({ ...reportBody, status }),
      );
      const updated = await updateReportStatus("clave", 7, status);

      expect(updated).toEqual({ ...reportBody, status });
    }

    expect(fetchMock()).toHaveBeenCalledTimes(3);
    const statuses = ["resuelto", "descartado", "pendiente"];
    for (const index of [0, 1, 2]) {
      const [url, init] = call(index);
      expect(url).toBe("http://localhost:8000/reports/7");
      expect(init.method).toBe("PATCH");
      expect(init.headers).toEqual({
        "X-API-Key": "clave",
        "Content-Type": "application/json",
      });
      expect(String(init.body)).toBe(`{"status":"${statuses[index]}"}`);
      expect(Object.keys(JSON.parse(String(init.body)))).toEqual(["status"]);
      expect(String(init.body)).not.toContain("clave");
    }
  });

  it("API-07 rejects a missing, empty or non-string key without fetch", async () => {
    for (const key of ["", 42, null, undefined]) {
      const badKey = key as unknown as string;
      await expect(getReportStats(badKey)).rejects.toMatchObject({
        kind: "validation",
        message: "La clave de administración es obligatoria.",
      });
      await expect(
        getReports(badKey, { status: "pendiente", skip: 0, limit: 20 }),
      ).rejects.toMatchObject({
        kind: "validation",
        message: "La clave de administración es obligatoria.",
      });
      await expect(
        updateReportStatus(badKey, 7, "resuelto"),
      ).rejects.toMatchObject({
        kind: "validation",
        message: "La clave de administración es obligatoria.",
      });
    }
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("API-08 rejects an invalid list status without fetch", async () => {
    for (const status of ["pending", "foo", ""]) {
      await expect(
        getReports("clave", {
          status: status as AdminReportStatusFilter,
          skip: 0,
          limit: 20,
        }),
      ).rejects.toMatchObject({
        kind: "validation",
        message: "El filtro de estado no es válido.",
      });
    }
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("API-09 rejects an invalid questionId without fetch", async () => {
    for (const questionId of [0, -1, 1.5, "42"]) {
      await expect(
        getReports("clave", {
          status: "pendiente",
          questionId: questionId as unknown as number,
          skip: 0,
          limit: 20,
        }),
      ).rejects.toMatchObject({
        kind: "validation",
        message: "El id de la pregunta no es válido.",
      });
    }
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("API-10 rejects an invalid skip without fetch", async () => {
    for (const skip of [-1, 1.5, "0"]) {
      await expect(
        getReports("clave", {
          status: "pendiente",
          skip: skip as unknown as number,
          limit: 20,
        }),
      ).rejects.toMatchObject({
        kind: "validation",
        message: "La página de reportes no es válida.",
      });
    }
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("API-11 rejects an invalid limit without fetch", async () => {
    for (const limit of [0, 101, 1.5]) {
      await expect(
        getReports("clave", { status: "pendiente", skip: 0, limit }),
      ).rejects.toMatchObject({
        kind: "validation",
        message: "El tamaño de página no es válido.",
      });
    }
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("API-12 rejects an invalid reportId without fetch", async () => {
    for (const reportId of [0, -1, 1.5, "7"]) {
      await expect(
        updateReportStatus("clave", reportId as unknown as number, "resuelto"),
      ).rejects.toMatchObject({
        kind: "validation",
        message: "El reporte no es válido.",
      });
    }
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("API-13 rejects an invalid PATCH status without fetch", async () => {
    for (const status of ["pending", "foo", ""]) {
      await expect(
        updateReportStatus("clave", 7, status as unknown as "resuelto"),
      ).rejects.toMatchObject({
        kind: "validation",
        message: "El estado del reporte no es válido.",
      });
    }
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("API-14 propagates the stats validator detail", async () => {
    fetchMock().mockResolvedValueOnce(
      jsonResponse({
        pendiente: -1,
        resuelto: 0,
        descartado: 0,
        pending_by_reason: {},
      }),
    );

    await expect(getReportStats("clave")).rejects.toMatchObject({
      kind: "validation",
      message: "Respuesta inválida del servidor.",
      detail: "contador de pendientes inválido",
    });
    expect(fetchMock()).toHaveBeenCalledTimes(1);
  });

  it("API-15 propagates the list and item validator details", async () => {
    fetchMock()
      .mockResolvedValueOnce(jsonResponse({ not: "an array" }))
      .mockResolvedValueOnce(jsonResponse([{ ...reportBody, comment: 0 }]))
      .mockResolvedValueOnce(
        jsonResponse([reportBody, { ...reportBody, id: 8, question_id: 0 }]),
      );

    await expect(
      getReports("clave", { status: "pendiente", skip: 0, limit: 20 }),
    ).rejects.toMatchObject({
      kind: "validation",
      message: "Respuesta inválida del servidor.",
      detail: "lista de reportes inválida",
    });
    await expect(
      getReports("clave", { status: "pendiente", skip: 0, limit: 20 }),
    ).rejects.toMatchObject({
      kind: "validation",
      message: "Respuesta inválida del servidor.",
      detail: "comentario de reporte inválido",
    });
    await expect(
      getReports("clave", { status: "pendiente", skip: 0, limit: 20 }),
    ).rejects.toMatchObject({
      kind: "validation",
      message: "Respuesta inválida del servidor.",
      detail: "question_id inválido",
    });
    expect(fetchMock()).toHaveBeenCalledTimes(3);
  });

  it("API-16 propagates the PATCH validator detail", async () => {
    fetchMock().mockResolvedValueOnce(
      jsonResponse({ ...reportBody, status: "" }),
    );

    await expect(
      updateReportStatus("clave", 7, "resuelto"),
    ).rejects.toMatchObject({
      kind: "validation",
      message: "Respuesta inválida del servidor.",
      detail: "estado de reporte inválido",
    });
    expect(fetchMock()).toHaveBeenCalledTimes(1);
  });

  it("API-17 validates inputs in the frozen order", async () => {
    await expect(
      getReports("", {
        status: "foo" as AdminReportStatusFilter,
        questionId: 0,
        skip: -1,
        limit: 0,
      }),
    ).rejects.toMatchObject({
      message: "La clave de administración es obligatoria.",
    });
    await expect(
      getReports("clave", {
        status: "foo" as AdminReportStatusFilter,
        questionId: 0,
        skip: -1,
        limit: 0,
      }),
    ).rejects.toMatchObject({
      message: "El filtro de estado no es válido.",
    });
    await expect(
      updateReportStatus("", 0, "foo" as unknown as "resuelto"),
    ).rejects.toMatchObject({
      message: "La clave de administración es obligatoria.",
    });
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("API-18 the key never leaves the X-API-Key header", async () => {
    fetchMock()
      .mockResolvedValueOnce(jsonResponse(statsBody))
      .mockResolvedValueOnce(jsonResponse([reportBody]))
      .mockResolvedValueOnce(
        jsonResponse({ ...reportBody, status: "resuelto" }),
      );

    await getReportStats("clave");
    await getReports("clave", { status: "pendiente", skip: 0, limit: 20 });
    await updateReportStatus("clave", 7, "resuelto");

    for (const index of [0, 1, 2]) {
      const [url, init] = call(index);
      expect(url).not.toContain("clave");
      expect(String(init.body)).not.toContain("clave");
      expect(JSON.stringify({ ...init, headers: undefined })).not.toContain(
        "clave",
      );
      const headers = init.headers as Record<string, string>;
      expect(headers["X-API-Key"]).toBe("clave");
      expect(
        Object.keys(headers).filter((name) => headers[name] === "clave"),
      ).toEqual(["X-API-Key"]);
    }
  });

  it("API-19 the label constants and the page size are the exact copy", () => {
    expect(ADMIN_REPORT_PAGE_SIZE).toBe(20);
    expect(ADMIN_STATUS_LABELS).toEqual({
      pendiente: "Pendiente",
      resuelto: "Resuelto",
      descartado: "Descartado",
    });
    expect(ADMIN_STATUS_FILTER_OPTIONS).toEqual([
      { value: "pendiente", label: "Pendientes" },
      { value: "resuelto", label: "Resueltos" },
      { value: "descartado", label: "Descartados" },
      { value: "todos", label: "Todos" },
    ]);
    expect(ADMIN_REPORT_LANG_LABELS).toEqual({ es: "Español", en: "English" });
  });
});
