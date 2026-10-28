import { describe, expect, it } from "vitest";
import * as api from "./index";

describe("api index", () => {
  it("exports modules", () => {
    expect(api.ApiError).toBeDefined();
    expect(api.getCategories).toBeDefined();
    expect(api.getGameQuestion).toBeDefined();
    expect(api.submitAnswer).toBeDefined();
    expect(api.getApiBaseUrl).toBeDefined();
    expect(api.buildUrl).toBeDefined();
    expect(api.reportQuestion).toBeDefined();
    expect(api.REPORT_REASONS).toBeDefined();
    expect(api.MAX_REPORT_COMMENT_LENGTH).toBe(500);
    expect(api.isReportReason).toBeDefined();
    expect(api.normalizeReportComment).toBeDefined();
    expect(api.getReportStats).toBeDefined();
    expect(api.getReports).toBeDefined();
    expect(api.updateReportStatus).toBeDefined();
    expect(api.getAdminFailure).toBeDefined();
    expect(api.ADMIN_EXPIRED_KEY_MESSAGE).toBe(
      "La clave dejó de ser válida. Volvé a ingresar la clave.",
    );
    expect(api.ADMIN_MISSING_KEY_MESSAGE).toBe(
      "La API no tiene la clave de administración configurada.",
    );
    expect(api.ADMIN_REPORT_PAGE_SIZE).toBe(20);
    expect(api.ADMIN_STATUS_LABELS.pendiente).toBe("Pendiente");
    expect(api.ADMIN_STATUS_FILTER_OPTIONS).toHaveLength(4);
    expect(api.ADMIN_REPORT_LANG_LABELS.es).toBe("Español");
    expect(api.getQuestion).toBeDefined();
    expect(api.updateQuestion).toBeDefined();
    expect(api.hideQuestion).toBeDefined();
    expect(api.getQuestionEdits).toBeDefined();
    expect(api.getQuestionEditFailure).toBeDefined();
    expect(api.REPORT_STATUSES).toEqual([
      "pendiente",
      "resuelto",
      "descartado",
    ]);
    expect(api.isReportStatus("resuelto")).toBe(true);
  });
});
