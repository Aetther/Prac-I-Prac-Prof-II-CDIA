// @vitest-environment node
import { describe, expect, it } from "vitest";
import { formatAdminTimestamp } from "./adminDateFormat";

describe("formatAdminTimestamp", () => {
  it("DATE-01 a Z instant renders the Buenos Aires short date-time", () => {
    expect(formatAdminTimestamp("2026-10-26T12:00:00Z")).toBe(
      "26/10/26, 9:00 a. m.",
    );
  });

  it("DATE-02 an explicit +00:00 offset renders the same instant identically", () => {
    expect(formatAdminTimestamp("2026-10-26T12:00:00+00:00")).toBe(
      "26/10/26, 9:00 a. m.",
    );
    expect(formatAdminTimestamp("2026-10-26T12:00:00+00:00")).toBe(
      formatAdminTimestamp("2026-10-26T12:00:00Z"),
    );
  });

  it("DATE-03 a morning UTC instant renders 6:30 in Buenos Aires", () => {
    expect(formatAdminTimestamp("2026-10-27T09:30:00Z")).toBe(
      "27/10/26, 6:30 a. m.",
    );
  });

  it("DATE-04 a UTC midnight crosses to the previous date in Buenos Aires", () => {
    expect(formatAdminTimestamp("2026-01-01T00:00:00Z")).toBe(
      "31/12/25, 9:00 p. m.",
    );
  });

  it("DATE-05 an unparseable value is returned verbatim, never Invalid Date", () => {
    expect(formatAdminTimestamp("no es una fecha")).toBe("no es una fecha");
    expect(formatAdminTimestamp("")).toBe("");
    expect(formatAdminTimestamp("no es una fecha")).not.toContain(
      "Invalid Date",
    );
  });
});
