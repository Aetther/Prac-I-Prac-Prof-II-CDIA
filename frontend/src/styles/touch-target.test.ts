// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("touch-target styles", () => {
  it("declares the 48px token and the touch-target rule", () => {
    const tokens = readFileSync(
      join(process.cwd(), "src/styles/tokens.css"),
      "utf-8",
    );
    const styles = readFileSync(
      join(process.cwd(), "src/styles/index.css"),
      "utf-8",
    );

    expect(tokens).toMatch(/--touch-target-min:\s*48px;/);
    expect(styles).toMatch(
      /\.touch-target\s*\{[^}]*min-height:\s*var\(--touch-target-min\);[^}]*\}/,
    );
    expect(styles).toMatch(
      /\.touch-target\s*\{[^}]*min-width:\s*var\(--touch-target-min\);[^}]*\}/,
    );
  });
});
