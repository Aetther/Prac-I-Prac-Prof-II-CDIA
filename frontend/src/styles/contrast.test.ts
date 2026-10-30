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

const CATEGORIES = [
  "geografia",
  "historia",
  "ciencia",
  "arte",
  "entretenimiento",
  "deportes",
] as const;

function bestBand(surface: string): number {
  return Math.max(
    ratioOf("--color-focus-ring", surface),
    ratioOf("--color-focus-ring-halo", surface),
  );
}

describe("palette v3 (dark) contrast", () => {
  it("The token file declares palette v2 and keeps the six category colours: palette v3 values", () => {
    const expected: Record<string, string> = {
      "--color-page-start": "#141c38",
      "--color-page-end": "#0b1022",
      "--color-on-page": "#e6e9f2",
      "--color-surface": "#1b2442",
      "--color-surface-muted": "#232e52",
      "--color-text": "#e6e9f2",
      "--color-text-secondary": "#aab2c8",
      "--color-control-border": "#7782a3",
      "--color-border": "#33406a",
      "--color-action": "#3fae6a",
      "--color-action-hover": "#369a5d",
      "--color-on-action": "#06210f",
      "--color-action-shadow": "#1f6e40",
      "--color-control-shadow": "#0a0f1f",
      "--color-focus-ring": "#e6e9f2",
      "--color-focus-ring-halo": "#05070f",
      "--color-disabled-surface": "#2b3557",
      "--color-disabled-text": "#9aa3bb",
      "--color-success": "#6fd39a",
      "--color-error": "#f29b93",
      "--color-sign-start": "#f0c95a",
      "--color-sign-end": "#e89a62",
      "--color-on-sign": "#141414",
      "--color-shine": "rgb(255 255 255 / 0.55)",
      "--color-on-category": "#ffffff",
      "--color-category-geografia": "#3d5fae",
      "--color-category-geografia-deep": "#24386b",
      "--color-category-historia": "#9c5b28",
      "--color-category-historia-deep": "#5c3415",
      "--color-category-ciencia": "#2d7a72",
      "--color-category-ciencia-deep": "#1b4945",
      "--color-category-arte": "#7b4fae",
      "--color-category-arte-deep": "#47306a",
      "--color-category-entretenimiento": "#a3466f",
      "--color-category-entretenimiento-deep": "#622a43",
      "--color-category-deportes": "#3c7a49",
      "--color-category-deportes-deep": "#24492c",
      "--color-player-1": "#e3925a",
      "--color-on-player-1": "#111827",
      "--color-player-1-deep": "#8a4a22",
      "--color-player-2": "#5aaedb",
      "--color-on-player-2": "#111827",
      "--color-player-2-deep": "#2a5f80",
      "--color-quiz-glow-start": "#9277ee",
      "--color-quiz-glow-end": "#55c7e0",
      "--color-option-a": "#f0a868",
      "--color-option-b": "#c9d66a",
      "--color-option-c": "#5cc9a7",
      "--color-option-d": "#b896e6",
      "--color-on-option": "#111827",
    };
    for (const [token, value] of Object.entries(expected)) {
      expect(declaredTokens.get(token), token).toBe(value);
    }
    expect(declaredTokens.has("--color-wheel-hub")).toBe(false);
  });

  it("PAL-01 the retired palette v1 and v2 values exist nowhere in shipped source", () => {
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
      "#1d4ed8",
      "#22c55e",
      "#f97316",
      "#0ea5e9",
      "#fde047",
      "#b45309",
      "#be185d",
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
    expect(TOKENS_CSS).toContain("--color-category-geografia: #3d5fae");
    expect(
      readFileSync(join(SRC, "components/CategoryChips.tsx"), "utf-8"),
    ).toContain("var(--color-category-geografia)");
  });

  it("CTR-02 text clears 4.5 on the dark page and on both card surfaces", () => {
    expect(ratioOf("--color-text", "--color-page-start")).toBeCloseTo(13.81, 2);
    expect(ratioOf("--color-text", "--color-page-end")).toBeCloseTo(15.57, 2);
    expect(ratioOf("--color-text", "--color-surface")).toBeCloseTo(12.56, 2);
    expect(ratioOf("--color-text", "--color-surface-muted")).toBeCloseTo(
      10.92,
      2,
    );
    expect(ratioOf("--color-text-secondary", "--color-surface")).toBeCloseTo(
      7.19,
      2,
    );
    expect(
      ratioOf("--color-text-secondary", "--color-surface-muted"),
    ).toBeCloseTo(6.26, 2);
    expect(ratioOf("--color-on-page", "--color-page-start")).toBeCloseTo(
      13.81,
      2,
    );
  });

  it("CTR-03 the action text clears 4.5 on the action green and its hover, and white on the action fails", () => {
    expect(ratioOf("--color-on-action", "--color-action")).toBeCloseTo(6.07, 2);
    expect(ratioOf("--color-on-action", "--color-action-hover")).toBeCloseTo(
      4.82,
      2,
    );
    expect(ratioOf("#ffffff", "--color-action")).toBeCloseTo(2.81, 2);
  });

  it("CTR-04 white on each of the six softer category colours clears 5", () => {
    const expected = [6.09, 5.33, 5.07, 5.88, 5.73, 5.16];
    CATEGORIES.forEach((name, index) => {
      expect(
        ratioOf("--color-on-category", `--color-category-${name}`),
        name,
      ).toBeCloseTo(expected[index], 2);
    });
  });

  it("CTR-05 white on each category deep variant clears 10", () => {
    const expected = [11.33, 10.73, 10.07, 11.06, 10.87, 10.17];
    CATEGORIES.forEach((name, index) => {
      expect(
        ratioOf("--color-on-category", `--color-category-${name}-deep`),
        name,
      ).toBeCloseTo(expected[index], 2);
    });
  });

  it("CTR-06 player, Turno, sign, status, disabled and control-boundary pairs clear their bars", () => {
    expect(ratioOf("--color-on-player-1", "--color-player-1")).toBeCloseTo(
      7.2,
      2,
    );
    expect(ratioOf("--color-on-player-2", "--color-player-2")).toBeCloseTo(
      7.19,
      2,
    );
    expect(ratioOf("--color-on-category", "--color-player-1-deep")).toBeCloseTo(
      6.81,
      2,
    );
    expect(ratioOf("--color-on-category", "--color-player-2-deep")).toBeCloseTo(
      6.89,
      2,
    );
    expect(ratioOf("--color-player-1", "--color-surface")).toBeCloseTo(6.19, 2);
    expect(ratioOf("--color-player-2", "--color-surface")).toBeCloseTo(6.18, 2);
    expect(ratioOf("--color-on-sign", "--color-sign-start")).toBeCloseTo(
      11.59,
      2,
    );
    expect(ratioOf("--color-on-sign", "--color-sign-end")).toBeCloseTo(8.1, 2);
    expect(ratioOf("--color-success", "--color-surface")).toBeCloseTo(8.32, 2);
    expect(ratioOf("--color-success", "--color-surface-muted")).toBeCloseTo(
      7.23,
      2,
    );
    expect(ratioOf("--color-error", "--color-surface")).toBeCloseTo(7.18, 2);
    expect(ratioOf("--color-error", "--color-surface-muted")).toBeCloseTo(
      6.24,
      2,
    );
    expect(
      ratioOf("--color-disabled-text", "--color-disabled-surface"),
    ).toBeCloseTo(4.76, 2);
    for (const [surface, ratio] of [
      ["--color-surface", 4.0],
      ["--color-surface-muted", 3.48],
      ["--color-page-start", 4.39],
      ["--color-page-end", 4.95],
    ] as const) {
      expect(ratioOf("--color-control-border", surface), surface).toBeCloseTo(
        ratio,
        2,
      );
    }
  });

  it("CTR-07 the two ring bands are 16.58 apart and the dark band rescues the action green", () => {
    expect(
      ratioOf("--color-focus-ring", "--color-focus-ring-halo"),
    ).toBeCloseTo(16.58, 2);
    expect(ratioOf("--color-focus-ring", "--color-action")).toBeLessThan(3);
    expect(ratioOf("--color-focus-ring-halo", "--color-action")).toBeCloseTo(
      7.16,
      2,
    );
    expect(
      ratioOf("--color-focus-ring-halo", "--color-page-start"),
    ).toBeLessThan(3);
    expect(ratioOf("--color-focus-ring", "--color-page-start")).toBeCloseTo(
      13.81,
      2,
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
      ...CATEGORIES.map((name) => `--color-category-${name}`),
      ...CATEGORIES.map((name) => `--color-category-${name}-deep`),
    ];
    for (const surface of surfaces) {
      expect(bestBand(surface), surface).toBeGreaterThanOrEqual(3);
    }
    expect(bestBand("--color-category-ciencia")).toBeCloseTo(4.18, 2);
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
      ...CATEGORIES.map(
        (name) =>
          ["--color-on-category", `--color-category-${name}`, 4.5] as const,
      ),
      ...CATEGORIES.map(
        (name) =>
          [
            "--color-on-category",
            `--color-category-${name}-deep`,
            4.5,
          ] as const,
      ),
      ["--color-on-player-1", "--color-player-1", 4.5],
      ["--color-on-player-2", "--color-player-2", 4.5],
      ["--color-on-category", "--color-player-1-deep", 4.5],
      ["--color-on-category", "--color-player-2-deep", 4.5],
      ["--color-player-1", "--color-surface", 4.5],
      ["--color-player-2", "--color-surface", 4.5],
      ["--color-on-sign", "--color-sign-start", 4.5],
      ["--color-on-sign", "--color-sign-end", 4.5],
      ["--color-success", "--color-surface", 4.5],
      ["--color-success", "--color-surface-muted", 4.5],
      ["--color-error", "--color-surface", 4.5],
      ["--color-error", "--color-surface-muted", 4.5],
      ["--color-disabled-text", "--color-disabled-surface", 4.5],
      ["--color-action", "--color-surface", 4.5],
      ["--color-action", "--color-surface-muted", 4.5],
      ["--color-control-border", "--color-surface", 3],
      ["--color-control-border", "--color-surface-muted", 3],
      ["--color-focus-ring", "--color-surface", 3],
      ["--color-focus-ring", "--color-page-start", 3],
      ["--color-timer-urgent", "--color-timer-track", 3],
    ];
    for (const [fg, bg, bar] of pairs) assertPair(fg, bg, bar);
    expect(() =>
      assertPair(
        "--color-text",
        "--color-surface",
        4.5,
        new Map(declaredTokens).set("--color-text", "#111827"),
      ),
    ).toThrow(/--color-text on --color-surface is 1\.16:1/);
  });

  it("CTR-10 the Reportar secondary text and border use the action green on the dark card", () => {
    expect(ratioOf("--color-action", "--color-surface")).toBeCloseTo(5.43, 2);
    expect(ratioOf("--color-action", "--color-surface-muted")).toBeCloseTo(
      4.72,
      2,
    );
    expect(ratioOf("--color-action-shadow", "--color-surface")).toBeLessThan(3);
  });

  it("CTR-11 the quiz letters and outlines clear their bars on the dark card", () => {
    const letters = ["a", "b", "c", "d"] as const;
    const onOption = [8.87, 11.24, 8.76, 7.22];
    const outline = [7.63, 9.66, 7.53, 6.2];
    letters.forEach((letter, index) => {
      expect(
        ratioOf("--color-on-option", `--color-option-${letter}`),
        letter,
      ).toBeCloseTo(onOption[index], 2);
      expect(
        ratioOf(`--color-option-${letter}`, "--color-surface"),
        letter,
      ).toBeCloseTo(outline[index], 2);
    });
    expect(ratioOf("--color-quiz-glow-start", "--color-page-end")).toBeCloseTo(
      5.48,
      2,
    );
    expect(ratioOf("--color-quiz-glow-end", "--color-page-end")).toBeCloseTo(
      9.57,
      2,
    );
  });

  it("ADJ-06 the metallic tagline and the gold GIRAR keep their text readable", () => {
    for (const stop of ["--color-metal-light", "--color-metal-mid"]) {
      for (const surface of [
        "--color-page-start",
        "--color-page-end",
        "--color-surface",
        "--color-surface-muted",
      ]) {
        assertPair(stop, surface, 4.5);
      }
    }
    expect(ratioOf("--color-metal-mid", "--color-surface-muted")).toBeCloseTo(
      8.06,
      2,
    );
    expect(ratioOf("--color-on-sign", "--color-sign-start")).toBeCloseTo(
      11.59,
      2,
    );
    expect(ratioOf("--color-on-sign", "--color-sign-end")).toBeCloseTo(8.1, 2);
  });
});
