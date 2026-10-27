// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  MAX_REPORT_COMMENT_LENGTH,
  REPORT_REASONS,
  isReportReason,
  normalizeReportComment,
} from "./reportReasons";

describe("report reasons", () => {
  it("lists the four wire values in order", () => {
    expect(REPORT_REASONS).toEqual([
      "traduccion",
      "respuesta_incorrecta",
      "error_texto",
      "otro",
    ]);
    expect(MAX_REPORT_COMMENT_LENGTH).toBe(500);
  });

  it("accepts exactly the four reasons", () => {
    for (const reason of REPORT_REASONS) {
      expect(isReportReason(reason)).toBe(true);
    }
    expect(isReportReason("traduccion")).toBe(true);
    expect(isReportReason("")).toBe(false);
    expect(isReportReason("pending")).toBe(false);
    expect(isReportReason(null)).toBe(false);
    expect(isReportReason(7)).toBe(false);
  });

  it("trims a comment before sending", () => {
    expect(normalizeReportComment("  Falta la tilde  ")).toBe("Falta la tilde");
    expect(normalizeReportComment("   ")).toBe("");
    expect(normalizeReportComment("texto")).toBe("texto");
  });
});
