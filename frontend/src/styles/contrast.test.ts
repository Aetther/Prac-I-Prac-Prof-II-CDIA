// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const TOKENS_CSS = readFileSync(
  join(process.cwd(), "src/styles/tokens.css"),
  "utf-8",
);
const SRC = join(process.cwd(), "src");

function parseTokens(css: string): Map<string, string> {
  const tokens = new Map<string, string>();
  const pattern = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(css)) !== null) {
    tokens.set(match[1], match[2].trim());
  }
  return tokens;
}

const declaredTokens = parseTokens(TOKENS_CSS);

function relativeLuminance(hex: string): number {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (match === null) throw new Error(`Unparseable colour: ${hex}`);
  const channels = match[1]
    .match(/../g)!
    .map((channel) => parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.03928
        ? channel / 12.92
        : Math.pow((channel + 0.055) / 1.055, 2.4),
    );
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

function resolve(value: string, tokens: Map<string, string>): string {
  if (value.startsWith("--")) {
    const resolved = tokens.get(value);
    if (resolved === undefined) throw new Error(`Missing token: ${value}`);
    return resolved;
  }
  return value;
}

function assertPair(
  foreground: string,
  background: string,
  bar: number,
  tokens: Map<string, string> = declaredTokens,
): void {
  const ratio = contrastRatio(
    resolve(foreground, tokens),
    resolve(background, tokens),
  );
  if (ratio < bar) {
    throw new Error(
      `${foreground} on ${background} is ${ratio.toFixed(2)}:1, below the ${bar}:1 bar`,
    );
  }
}

function ratioOf(foreground: string, background: string): number {
  return contrastRatio(
    resolve(foreground, declaredTokens),
    resolve(background, declaredTokens),
  );
}

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

const SHIPPED_SOURCES = walk(SRC).filter((file) => {
  const normalized = file.replace(/\\/g, "/");
  if (normalized.includes("/src/test/")) return false;
  if (normalized.endsWith(".test.ts") || normalized.endsWith(".test.tsx")) {
    return false;
  }
  return /\.(ts|tsx|css)$/.test(normalized);
});

describe("palette v2 contrast", () => {
  it("CTR-01 tokens.css declares palette v2, the six category colours and their deep variants", () => {
    const expected: ReadonlyArray<readonly [string, string]> = [
      ["--color-page-start", "#1d4ed8"],
      ["--color-page-end", "#1e3a8a"],
      ["--color-on-page", "#ffffff"],
      ["--color-surface", "#ffffff"],
      ["--color-surface-muted", "#f1f5f9"],
      ["--color-text", "#111827"],
      ["--color-text-secondary", "#4b5563"],
      ["--color-control-border", "#6b7280"],
      ["--color-border", "#e5e7eb"],
      ["--color-action", "#22c55e"],
      ["--color-action-hover", "#16a34a"],
      ["--color-on-action", "#052e16"],
      ["--color-action-shadow", "#15803d"],
      ["--color-control-shadow", "#cbd5e1"],
      ["--color-focus-ring", "#0b1220"],
      ["--color-focus-ring-halo", "#fde047"],
      ["--color-disabled-surface", "#e5e7eb"],
      ["--color-disabled-text", "#4b5563"],
      ["--color-success", "#15803d"],
      ["--color-error", "#b91c1c"],
      ["--color-sign-start", "#fde047"],
      ["--color-sign-end", "#fb923c"],
      ["--color-on-sign", "#111827"],
      ["--color-shine", "rgb(255 255 255 / 0.55)"],
      ["--color-player-1", "#f97316"],
      ["--color-on-player-1", "#111827"],
      ["--color-player-1-deep", "#9a3412"],
      ["--color-player-2", "#0ea5e9"],
      ["--color-on-player-2", "#111827"],
      ["--color-player-2-deep", "#075985"],
      ["--color-on-category", "#ffffff"],
      ["--color-timer-fill", "#1d4ed8"],
      ["--color-category-geografia", "#1d4ed8"],
      ["--color-category-historia", "#b45309"],
      ["--color-category-ciencia", "#0f766e"],
      ["--color-category-arte", "#7e22ce"],
      ["--color-category-entretenimiento", "#be185d"],
      ["--color-category-deportes", "#15803d"],
      ["--color-category-geografia-deep", "#1e3a8a"],
      ["--color-category-historia-deep", "#78350f"],
      ["--color-category-ciencia-deep", "#134e4a"],
      ["--color-category-arte-deep", "#581c87"],
      ["--color-category-entretenimiento-deep", "#831843"],
      ["--color-category-deportes-deep", "#14532d"],
    ];
    for (const [token, value] of expected) {
      expect(declaredTokens.get(token), token).toBe(value);
    }
    for (const retired of [
      "--color-background",
      "--color-primary",
      "--color-secondary",
      "--color-on-primary",
      "--color-on-secondary",
      "--color-wheel-hub",
    ]) {
      expect(declaredTokens.has(retired), retired).toBe(false);
    }
    expect(declaredTokens.get("--color-category-geografia")).toBe("#1d4ed8");
  });

  it("PAL-01 the retired palette tokens and hex values exist nowhere in shipped source", () => {
    const retired = [
      "--color-background",
      "--color-primary",
      "--color-secondary",
      "--color-on-primary",
      "--color-on-secondary",
      "--color-wheel-hub",
      "#f5f3ff",
      "#4f46e5",
      "#0e7490",
      "#f8fafc",
      "#f9fafb",
    ];
    const hits: string[] = [];
    for (const file of SHIPPED_SOURCES) {
      const content = readFileSync(file, "utf-8");
      for (const value of retired) {
        if (content.includes(value)) {
          hits.push(`${file.replace(/\\/g, "/")}: ${value}`);
        }
      }
    }
    expect(hits, hits.join("\n")).toEqual([]);
    expect(TOKENS_CSS).toContain("--color-category-geografia: #1d4ed8");
    expect(
      readFileSync(join(SRC, "components/CategoryChips.tsx"), "utf-8"),
    ).toContain("var(--color-category-geografia)");
  });

  it("CTR-02 text clears 4.5 on the page gradient and on both card surfaces", () => {
    expect(ratioOf("--color-on-page", "--color-page-start")).toBeCloseTo(
      6.7,
      2,
    );
    expect(ratioOf("--color-on-page", "--color-page-end")).toBeCloseTo(
      10.36,
      2,
    );
    expect(ratioOf("--color-text", "--color-surface")).toBeCloseTo(17.74, 2);
    expect(ratioOf("--color-text", "--color-surface-muted")).toBeCloseTo(
      16.19,
      2,
    );
    expect(ratioOf("--color-text-secondary", "--color-surface")).toBeCloseTo(
      7.56,
      2,
    );
    expect(
      ratioOf("--color-text-secondary", "--color-surface-muted"),
    ).toBeCloseTo(6.9, 2);
    for (const [fg, bg] of [
      ["--color-on-page", "--color-page-start"],
      ["--color-on-page", "--color-page-end"],
      ["--color-text", "--color-surface"],
      ["--color-text", "--color-surface-muted"],
      ["--color-text-secondary", "--color-surface"],
      ["--color-text-secondary", "--color-surface-muted"],
    ] as const) {
      assertPair(fg, bg, 4.5);
    }
  });

  it("CTR-03 the action text clears 4.5 on the action green and its hover, and white on the action fails at 2.28", () => {
    expect(ratioOf("--color-on-action", "--color-action")).toBeCloseTo(6.54, 2);
    expect(ratioOf("--color-on-action", "--color-action-hover")).toBeCloseTo(
      4.52,
      2,
    );
    assertPair("--color-on-action", "--color-action", 4.5);
    assertPair("--color-on-action", "--color-action-hover", 4.5);
    expect(contrastRatio("#ffffff", "#22c55e")).toBeCloseTo(2.28, 2);
    expect(() => assertPair("#ffffff", "--color-action", 4.5)).toThrow(/2\.28/);
  });

  it("CTR-04 white on each of the six category colours clears 4.5", () => {
    const categories: ReadonlyArray<readonly [string, number]> = [
      ["--color-category-geografia", 6.7],
      ["--color-category-historia", 5.02],
      ["--color-category-ciencia", 5.47],
      ["--color-category-arte", 6.98],
      ["--color-category-entretenimiento", 6.04],
      ["--color-category-deportes", 5.02],
    ];
    for (const [token, expected] of categories) {
      expect(ratioOf("--color-on-category", token), token).toBeCloseTo(
        expected,
        2,
      );
      assertPair("--color-on-category", token, 4.5);
    }
  });

  it("CTR-05 white on each category deep variant clears 4.5", () => {
    const deep: ReadonlyArray<readonly [string, number]> = [
      ["--color-category-geografia-deep", 10.36],
      ["--color-category-historia-deep", 9.07],
      ["--color-category-ciencia-deep", 9.48],
      ["--color-category-arte-deep", 10.88],
      ["--color-category-entretenimiento-deep", 9.65],
      ["--color-category-deportes-deep", 9.11],
    ];
    for (const [token, expected] of deep) {
      expect(ratioOf("--color-on-category", token), token).toBeCloseTo(
        expected,
        2,
      );
      assertPair("--color-on-category", token, 4.5);
    }
  });

  it("CTR-06 player, sign, status, disabled and control-boundary pairs clear their bars", () => {
    expect(ratioOf("--color-on-player-1", "--color-player-1")).toBeCloseTo(
      6.33,
      2,
    );
    expect(ratioOf("--color-on-player-2", "--color-player-2")).toBeCloseTo(
      6.4,
      2,
    );
    expect(ratioOf("--color-on-page", "--color-player-1-deep")).toBeCloseTo(
      7.31,
      2,
    );
    expect(ratioOf("--color-on-page", "--color-player-2-deep")).toBeCloseTo(
      7.56,
      2,
    );
    expect(ratioOf("--color-player-1-deep", "--color-surface")).toBeCloseTo(
      7.31,
      2,
    );
    expect(ratioOf("--color-player-2-deep", "--color-surface")).toBeCloseTo(
      7.56,
      2,
    );
    expect(ratioOf("--color-on-sign", "--color-sign-start")).toBeCloseTo(
      13.46,
      2,
    );
    expect(ratioOf("--color-on-sign", "--color-sign-end")).toBeCloseTo(7.84, 2);
    expect(ratioOf("--color-success", "--color-surface")).toBeCloseTo(5.02, 2);
    expect(ratioOf("--color-success", "--color-surface-muted")).toBeCloseTo(
      4.58,
      2,
    );
    expect(ratioOf("--color-error", "--color-surface")).toBeCloseTo(6.47, 2);
    expect(ratioOf("--color-error", "--color-surface-muted")).toBeCloseTo(
      5.91,
      2,
    );
    expect(
      ratioOf("--color-disabled-text", "--color-disabled-surface"),
    ).toBeCloseTo(6.1, 2);
    expect(ratioOf("--color-control-border", "--color-surface")).toBeCloseTo(
      4.83,
      2,
    );
    expect(
      ratioOf("--color-control-border", "--color-surface-muted"),
    ).toBeCloseTo(4.41, 2);

    for (const [fg, bg] of [
      ["--color-on-player-1", "--color-player-1"],
      ["--color-on-player-2", "--color-player-2"],
      ["--color-on-page", "--color-player-1-deep"],
      ["--color-on-page", "--color-player-2-deep"],
      ["--color-player-1-deep", "--color-surface", 4.5],
      ["--color-player-2-deep", "--color-surface", 4.5],
      ["--color-on-sign", "--color-sign-start"],
      ["--color-on-sign", "--color-sign-end"],
      ["--color-success", "--color-surface"],
      ["--color-success", "--color-surface-muted"],
      ["--color-error", "--color-surface"],
      ["--color-error", "--color-surface-muted"],
      ["--color-disabled-text", "--color-disabled-surface"],
    ] as const) {
      assertPair(fg, bg, 4.5);
    }
    assertPair("--color-control-border", "--color-surface", 3);
    assertPair("--color-control-border", "--color-surface-muted", 3);
    // Button boundaries: the white edge on page/player surfaces and the
    // control border on white/muted cards.
    assertPair("--color-on-page", "--color-page-start", 3);
    assertPair("--color-on-page", "--color-page-end", 3);
    assertPair("--color-on-page", "--color-player-1-deep", 3);
    assertPair("--color-on-page", "--color-player-2-deep", 3);
    expect(() =>
      assertPair("--color-control-border", "--color-surface-muted", 4.5),
    ).toThrow(/4\.41/);
  });

  it("CTR-07 the two ring bands are 14.20 apart and the dark band is only rescued by the halo on the player surfaces", () => {
    expect(
      ratioOf("--color-focus-ring-halo", "--color-page-start"),
    ).toBeCloseTo(5.08, 2);
    expect(ratioOf("--color-focus-ring-halo", "--color-page-end")).toBeCloseTo(
      7.86,
      2,
    );
    expect(
      ratioOf("--color-focus-ring-halo", "--color-player-1-deep"),
    ).toBeCloseTo(5.54, 2);
    expect(
      ratioOf("--color-focus-ring-halo", "--color-player-2-deep"),
    ).toBeCloseTo(5.74, 2);
    expect(ratioOf("--color-focus-ring", "--color-surface")).toBeCloseTo(
      18.72,
      2,
    );
    expect(ratioOf("--color-focus-ring", "--color-action")).toBeCloseTo(
      8.22,
      2,
    );
    expect(
      ratioOf("--color-focus-ring", "--color-focus-ring-halo"),
    ).toBeCloseTo(14.2, 2);
    expect(ratioOf("--color-focus-ring", "--color-player-1-deep")).toBeCloseTo(
      2.56,
      2,
    );
    expect(ratioOf("--color-focus-ring", "--color-player-2-deep")).toBeCloseTo(
      2.48,
      2,
    );
    expect(ratioOf("--color-focus-ring", "--color-player-1-deep")).toBeLessThan(
      3,
    );
    expect(ratioOf("--color-focus-ring", "--color-player-2-deep")).toBeLessThan(
      3,
    );
  });

  it("CTR-08 every declared surface has at least one focus band at 3 to 1", () => {
    const surfaces = [
      "--color-page-start",
      "--color-page-end",
      "--color-surface",
      "--color-surface-muted",
      "--color-action",
      "--color-player-1-deep",
      "--color-player-2-deep",
      "--color-category-geografia",
      "--color-category-historia",
      "--color-category-ciencia",
      "--color-category-arte",
      "--color-category-entretenimiento",
      "--color-category-deportes",
    ] as const;
    for (const surface of surfaces) {
      const halo = ratioOf("--color-focus-ring-halo", surface);
      const dark = ratioOf("--color-focus-ring", surface);
      expect(Math.max(halo, dark), surface).toBeGreaterThanOrEqual(3);
    }
    expect(ratioOf("--color-focus-ring", "--color-player-1-deep")).toBeLessThan(
      3,
    );
    expect(
      ratioOf("--color-focus-ring-halo", "--color-player-1-deep"),
    ).toBeGreaterThanOrEqual(3);
  });

  it("CTR-09 the full sweep names the token pair and the ratio when it fails", () => {
    const pairs: ReadonlyArray<readonly [string, string, number]> = [
      ["--color-on-page", "--color-page-start", 4.5],
      ["--color-on-page", "--color-page-end", 4.5],
      ["--color-text", "--color-surface", 4.5],
      ["--color-text", "--color-surface-muted", 4.5],
      ["--color-text-secondary", "--color-surface", 4.5],
      ["--color-text-secondary", "--color-surface-muted", 4.5],
      ["--color-on-action", "--color-action", 4.5],
      ["--color-on-action", "--color-action-hover", 4.5],
      ["--color-on-category", "--color-category-geografia", 4.5],
      ["--color-on-category", "--color-category-historia", 4.5],
      ["--color-on-category", "--color-category-ciencia", 4.5],
      ["--color-on-category", "--color-category-arte", 4.5],
      ["--color-on-category", "--color-category-entretenimiento", 4.5],
      ["--color-on-category", "--color-category-deportes", 4.5],
      ["--color-on-category", "--color-category-geografia-deep", 4.5],
      ["--color-on-category", "--color-category-historia-deep", 4.5],
      ["--color-on-category", "--color-category-ciencia-deep", 4.5],
      ["--color-on-category", "--color-category-arte-deep", 4.5],
      ["--color-on-category", "--color-category-entretenimiento-deep", 4.5],
      ["--color-on-category", "--color-category-deportes-deep", 4.5],
      ["--color-on-player-1", "--color-player-1", 4.5],
      ["--color-on-player-2", "--color-player-2", 4.5],
      ["--color-on-page", "--color-player-1-deep", 4.5],
      ["--color-on-page", "--color-player-2-deep", 4.5],
      ["--color-player-1-deep", "--color-surface", 4.5],
      ["--color-player-2-deep", "--color-surface", 4.5],
      ["--color-on-sign", "--color-sign-start", 4.5],
      ["--color-on-sign", "--color-sign-end", 4.5],
      ["--color-success", "--color-surface", 4.5],
      ["--color-success", "--color-surface-muted", 4.5],
      ["--color-error", "--color-surface", 4.5],
      ["--color-error", "--color-surface-muted", 4.5],
      ["--color-disabled-text", "--color-disabled-surface", 4.5],
      ["--color-control-border", "--color-surface", 3],
      ["--color-control-border", "--color-surface-muted", 3],
      ["--color-focus-ring", "--color-surface", 3],
      ["--color-focus-ring-halo", "--color-page-start", 3],
    ];
    for (const [fg, bg, bar] of pairs) assertPair(fg, bg, bar);
    expect(() =>
      assertPair(
        "--color-on-action",
        "--color-action",
        4.5,
        new Map(declaredTokens).set("--color-on-action", "#ffffff"),
      ),
    ).toThrow(/--color-on-action .* --color-action .*2\.28/);
  });

  it("CTR-10 the Reportar secondary text and border use the deep action colour on white", () => {
    assertPair("--color-action-shadow", "--color-surface", 4.5);
    assertPair("--color-action-shadow", "--color-surface-muted", 4.5);
    expect(ratioOf("--color-action-shadow", "--color-surface")).toBeCloseTo(
      5.02,
      2,
    );
    expect(ratioOf("--color-action", "--color-surface")).toBeLessThan(3);
  });
});
