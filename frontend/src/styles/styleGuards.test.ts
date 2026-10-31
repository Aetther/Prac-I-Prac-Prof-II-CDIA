// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { CATEGORY_COLOR_TOKENS } from "../components/CategoryChips";

const SRC = join(process.cwd(), "src");
const STYLES = join(SRC, "styles");
const FONT_DIR = join(process.cwd(), "public/fonts");
const INDEX_CSS = readFileSync(join(STYLES, "index.css"), "utf-8");
const TOKENS_CSS = readFileSync(join(STYLES, "tokens.css"), "utf-8");
const FONTS_CSS = readFileSync(join(STYLES, "fonts.css"), "utf-8");

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(fullPath));
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

function relative(file: string): string {
  return file.slice(SRC.length + 1).replace(/\\/g, "/");
}

interface ColourHit {
  readonly line: number;
  readonly literal: string;
}

function findColourLiterals(text: string): ColourHit[] {
  const pattern = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/g;
  const hits: ColourHit[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    hits.push({
      line: text.slice(0, match.index).split("\n").length,
      literal: match[0],
    });
  }
  return hits;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalize(css: string): string {
  return css.replace(/\s+/g, " ").trim();
}

function ruleBody(css: string, selector: string): string | null {
  const pattern = new RegExp(`${escapeRegExp(selector)}\\s*\\{([^}]*)\\}`, "g");
  const match = pattern.exec(css);
  return match === null ? null : normalize(match[1]);
}

interface CssRule {
  readonly selector: string;
  readonly body: string;
}

function cssRules(css: string): CssRule[] {
  const withoutImports = css.replace(/^@import[^\n]*$/gm, "");
  const withoutComments = withoutImports.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules: CssRule[] = [];
  let index = 0;
  while (index < withoutComments.length) {
    const open = withoutComments.indexOf("{", index);
    if (open === -1) break;
    const selector = withoutComments.slice(index, open).trim();
    let depth = 1;
    let cursor = open + 1;
    while (cursor < withoutComments.length && depth > 0) {
      if (withoutComments[cursor] === "{") depth += 1;
      else if (withoutComments[cursor] === "}") depth -= 1;
      cursor += 1;
    }
    const body = withoutComments.slice(open + 1, cursor - 1);
    if (selector.startsWith("@media")) rules.push(...cssRules(body));
    else if (selector !== "") rules.push({ selector, body });
    index = cursor;
  }
  return rules;
}

function blockAfter(css: string, marker: string): string | null {
  const start = css.indexOf(marker);
  if (start === -1) return null;
  const open = css.indexOf("{", start);
  if (open === -1) return null;
  let depth = 0;
  for (let index = open; index < css.length; index += 1) {
    if (css[index] === "{") depth += 1;
    if (css[index] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, index);
    }
  }
  return null;
}

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

function findOutlineNone(css: string): string[] {
  const pattern = /outline:\s*(none|0)\b|outline-style:\s*none\b/g;
  return [...css.matchAll(pattern)].map((match) => match[0]);
}

type Specificity = readonly [number, number, number];

function selectorSpecificity(selector: string): Specificity {
  const tokens =
    selector
      .replace(/"[^"]*"|'[^']*'/g, "")
      .match(
        /#[\w-]+|\.[\w-]+|\[[^\]]*\]|::?[\w-]+(?:\([^)]*\))?|[a-zA-Z][\w-]*/g,
      ) ?? [];
  let ids = 0;
  let classes = 0;
  let elements = 0;
  for (const token of tokens) {
    if (token.startsWith("#")) ids += 1;
    else if (
      token.startsWith(".") ||
      token.startsWith("[") ||
      token.startsWith(":")
    ) {
      classes += 1;
    } else {
      elements += 1;
    }
  }
  return [ids, classes, elements];
}

function compareSpecificity(a: Specificity, b: Specificity): number {
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

function selectorsOf(rule: CssRule): string[] {
  return rule.selector.split(",").map((selector) => selector.trim());
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function rgbDistance(a: string, b: string): number {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return Math.hypot(ar - br, ag - bg, ab - bb);
}

interface FontFace {
  readonly body: string;
}

function fontFaces(css: string): FontFace[] {
  const faces: FontFace[] = [];
  const pattern = /@font-face\s*\{([^}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(css)) !== null) {
    faces.push({ body: normalize(match[1]) });
  }
  return faces;
}

function faceIsComplete(body: string): boolean {
  const weight = /font-weight:\s*(400|600|700|800);/.exec(body)?.[1];
  if (weight === undefined) return false;
  return (
    /font-family:\s*"Baloo 2";/.test(body) &&
    /font-style:\s*normal;/.test(body) &&
    new RegExp(
      `src:\\s*url\\("/fonts/baloo-2-latin-${weight}-normal\\.woff2"\\)\\s*format\\("woff2"\\);`,
    ).test(body) &&
    /font-display:\s*swap;/.test(body) &&
    /unicode-range:/.test(body)
  );
}

describe("style guards", () => {
  it("GUARD-01 no .tsx file or stylesheet outside tokens.css hardcodes a colour literal", () => {
    const styles = readdirSync(STYLES)
      .filter((name) => name.endsWith(".css") && name !== "tokens.css")
      .map((name) => join(STYLES, name));
    const files = [
      ...walk(SRC).filter((file) => file.endsWith(".tsx")),
      ...styles,
    ];
    const hits: string[] = [];

    for (const file of files) {
      let text = readFileSync(file, "utf-8");
      if (file.endsWith(".css")) text = text.replace(/^@import[^\n]*$/gm, "");
      for (const hit of findColourLiterals(text)) {
        hits.push(`${relative(file)}:${hit.line} ${hit.literal}`);
      }
    }

    expect(files.some((file) => file.endsWith("CategoryChips.tsx"))).toBe(true);
    expect(files.some((file) => file.endsWith("fonts.css"))).toBe(true);
    expect(hits, hits.join("\n")).toEqual([]);
    expect(findColourLiterals('<div style={{ color: "#ff0000" }} />')).toEqual([
      { line: 1, literal: "#ff0000" },
    ]);
  });

  it("GUARD-02 every category chip colour is a var() token and the Geografía token is the positive control", () => {
    const entries = Object.entries(CATEGORY_COLOR_TOKENS);
    expect(entries).toHaveLength(6);
    for (const [name, value] of entries) {
      expect(value, name).toMatch(/^var\(--color-category-[a-z]+\)$/);
    }
    expect(CATEGORY_COLOR_TOKENS.geografia).toBe(
      "var(--color-category-geografia)",
    );
  });

  it("GUARD-03 index.css declares a two-tone focus-visible ring with both ring tokens and a 2 px offset", () => {
    const rule = ruleBody(INDEX_CSS, ":focus-visible");
    expect(rule).not.toBeNull();
    expect(rule!).toContain("var(--color-focus-ring)");
    expect(rule!).toContain("var(--color-focus-ring-halo)");
    expect(rule!).toContain("outline: 2px solid");
    expect(rule!).toContain("outline-offset: 2px");
  });

  it("GUARD-04 the reduced-motion block stops animations, hides the confetti and removes the timer width transition", () => {
    const block = blockAfter(
      INDEX_CSS,
      "@media (prefers-reduced-motion: reduce)",
    );
    expect(block).not.toBeNull();
    const normalized = normalize(block!);
    expect(normalized).toContain("animation-duration: 0s");
    expect(normalized).toContain("animation-iteration-count: 1");
    expect(normalized).toContain("animation-name: none");
    expect(normalized).toContain("transition-property: none");
    expect(normalized).toContain(".timer-fill");
    expect(normalized).toMatch(/\.timer-fill \{ transition: none/);
    expect(normalized).toMatch(/\.game-over-confetti \{ display: none/);
  });

  it("GUARD-05 index.css never removes an outline without a replacement", () => {
    expect(findOutlineNone(INDEX_CSS)).toEqual([]);
    expect(findOutlineNone(".x { outline: none; }")).toEqual(["outline: none"]);
  });

  it("GUARD-06 the type scale, line heights, layout widths and motion tokens keep their values", () => {
    const expected: ReadonlyArray<readonly [string, string]> = [
      ["--font-size-xs", "0.75rem"],
      ["--font-size-sm", "0.875rem"],
      ["--font-size-base", "1rem"],
      ["--font-size-lg", "1.125rem"],
      ["--font-size-xl", "1.25rem"],
      ["--font-size-2xl", "1.5rem"],
      ["--font-size-3xl", "clamp(1.75rem, 1.5rem + 1vw, 2.5rem)"],
      ["--font-size-display", "clamp(2rem, 1.5rem + 2.5vw, 3.5rem)"],
      ["--line-height-body", "1.6"],
      ["--line-height-heading", "1.2"],
      ["--content-max", "48rem"],
      ["--narrow-max", "40rem"],
      ["--admin-max", "72rem"],
      ["--rail-width", "20rem"],
      ["--duration-fast", "120ms"],
      ["--duration-bounce", "420ms"],
      ["--duration-icon", "360ms"],
      ["--duration-confetti", "3000ms"],
      ["--duration-shine", "2800ms"],
      ["--duration-timer", "250ms"],
      ["--easing-standard", "cubic-bezier(0.2, 0, 0.4, 1)"],
      ["--touch-target-min", "48px"],
    ];
    for (const [token, value] of expected) {
      expect(declaredTokens.get(token), token).toBe(value);
    }
    const widths = [
      declaredTokens.get("--content-max"),
      declaredTokens.get("--narrow-max"),
      declaredTokens.get("--admin-max"),
    ];
    expect(new Set(widths).size).toBe(3);
  });

  it("GUARD-07 index.css declares the tablet and desktop queries and a one-column base game-layout", () => {
    expect(INDEX_CSS).toContain("@media (min-width: 48rem)");
    expect(INDEX_CSS).toContain("@media (min-width: 64rem)");
    const base = ruleBody(INDEX_CSS, ".game-layout");
    expect(base).not.toBeNull();
    expect(base!).not.toMatch(/grid-template-columns/);
    const desktop = blockAfter(INDEX_CSS, "@media (min-width: 64rem)");
    expect(desktop).not.toBeNull();
    const desktopLayout = ruleBody(desktop!, ".game-layout");
    expect(desktopLayout).not.toBeNull();
    expect(desktopLayout!).toMatch(/display: grid/);
    expect(desktopLayout!).toMatch(
      /grid-template-columns: minmax\(0, var\(--content-max\)\) var\(--rail-width\)/,
    );
    const rail = ruleBody(desktop!, ".game-layout > .scoreboard-rail");
    expect(rail).not.toBeNull();
    expect(rail!).toMatch(/position: sticky/);
    const twoTracks =
      /grid-template-columns: minmax\(0, var\(--content-max\)\) var\(--rail-width\)/;
    expect(twoTracks.test(desktopLayout!)).toBe(true);
    expect(twoTracks.test(base!)).toBe(false);
  });

  it("GUARD-08 .scoreboard-stat is nowrap and .category-chips still wraps", () => {
    const stat = ruleBody(INDEX_CSS, ".scoreboard-stat");
    expect(stat).not.toBeNull();
    expect(stat!).toContain("white-space: nowrap");
    const chips = ruleBody(INDEX_CSS, ".category-chips");
    expect(chips).not.toBeNull();
    expect(chips!).toContain("flex-wrap: wrap");
    expect(stat!).not.toContain("white-space: normal");
  });

  it("GUARD-09 scores and the countdown use tabular numerals", () => {
    const stat = ruleBody(INDEX_CSS, ".scoreboard-stat");
    expect(stat).not.toBeNull();
    expect(stat!).toContain("font-variant-numeric: tabular-nums");
    const declarations = [
      ...normalize(INDEX_CSS).matchAll(/font-variant-numeric:\s*tabular-nums/g),
    ];
    expect(declarations.length).toBeGreaterThanOrEqual(2);
    expect(INDEX_CSS).toMatch(
      /\.timer[^{]*\{[^}]*font-variant-numeric:\s*tabular-nums/,
    );
  });

  it("GUARD-10 the option palette outranks the generic question-card button rule and sets text in every state", () => {
    const containerRule = cssRules(INDEX_CSS).find(
      (rule) =>
        selectorsOf(rule).includes(".question-card button") &&
        /background-color:\s*var\(--color-action\)/.test(rule.body),
    );
    expect(containerRule).toBeDefined();
    const containerSpecificity = selectorSpecificity(".question-card button");
    const states: ReadonlyArray<readonly [string, string]> = [
      [
        ".question-card .option-button",
        "background-color: var(--color-surface)",
      ],
      [
        ".question-card .option-button:hover:not(:disabled)",
        "background-color: var(--color-surface-muted)",
      ],
      [
        ".question-card .option-button:active:not(:disabled)",
        "background-color: var(--color-surface)",
      ],
      [
        ".question-card .option-button:disabled",
        "background-color: var(--color-disabled-surface)",
      ],
    ];
    for (const [selector, background] of states) {
      const body = ruleBody(INDEX_CSS, selector);
      expect(body, selector).not.toBeNull();
      expect(body!, selector).toContain(background);
      expect(body!, `${selector} must set color`).toContain("color:");
      expect(
        compareSpecificity(selectorSpecificity(selector), containerSpecificity),
        selector,
      ).toBeGreaterThan(0);
    }
    expect(
      compareSpecificity(
        selectorSpecificity(".option-button"),
        containerSpecificity,
      ),
    ).toBeLessThan(0);
  });

  it("GUARD-11 the rounds total wraps without changing the scoreboard-stat nowrap rule", () => {
    const stat = ruleBody(INDEX_CSS, ".scoreboard-stat");
    expect(stat).not.toBeNull();
    expect(stat!).toContain("white-space: nowrap");
    const rounds = ruleBody(
      INDEX_CSS,
      ".scoreboard-stat.scoreboard-rounds-total",
    );
    expect(rounds).not.toBeNull();
    expect(rounds!).toContain("white-space: normal");
    expect(rounds!).not.toContain("nowrap");
    expect(
      compareSpecificity(
        selectorSpecificity(".scoreboard-stat.scoreboard-rounds-total"),
        selectorSpecificity(".scoreboard-stat"),
      ),
    ).toBeGreaterThan(0);
  });

  it("GUARD-12 the question heading wrap targets game-main and cannot be orphaned by a wrapper", () => {
    const heading = ruleBody(INDEX_CSS, ".game-main h2");
    expect(heading).not.toBeNull();
    expect(heading!).toContain("overflow-wrap: anywhere");
    const paragraph = ruleBody(INDEX_CSS, ".game-main p");
    expect(paragraph).not.toBeNull();
    expect(paragraph!).toContain("overflow-wrap: anywhere");
    expect(normalize(INDEX_CSS)).toMatch(
      /h1, h2, h3 \{[^}]*overflow-wrap: anywhere/,
    );
    expect(ruleBody(INDEX_CSS, ".question-card > h2")).toBeNull();
    expect(ruleBody(INDEX_CSS, ".result > p")).toBeNull();
    expect(
      ruleBody(
        ".question-card > h2 { overflow-wrap: anywhere; }",
        ".question-card > h2",
      ),
    ).toContain("overflow-wrap: anywhere");
  });

  it("GUARD-13 the wheel is not padded like a card and the canvas keeps its 380 px rule", () => {
    const rules = cssRules(INDEX_CSS);
    const wheelRules = rules.filter((rule) =>
      selectorsOf(rule).includes(".wheel"),
    );
    expect(wheelRules.length).toBeGreaterThan(0);
    const padded = wheelRules.filter((rule) =>
      /padding-inline\s*:/.test(rule.body),
    );
    expect(padded, padded.map((rule) => rule.selector).join(", ")).toEqual([]);
    const cards = rules.filter((rule) =>
      selectorsOf(rule).includes(".question-card"),
    );
    expect(cards.some((rule) => /padding-inline\s*:/.test(rule.body))).toBe(
      true,
    );
    const canvas = ruleBody(INDEX_CSS, ".wheel-canvas");
    expect(canvas).not.toBeNull();
    expect(canvas!).toContain("width: 380px");
    expect(canvas!).toContain("max-width: 100%");
    expect(canvas!).toContain("height: auto");
    expect(
      cssRules(".wheel { padding-inline: 1rem; }").some(
        (rule) =>
          rule.selector === ".wheel" && /padding-inline\s*:/.test(rule.body),
      ),
    ).toBe(true);
  });

  it("FONT-01 the four Baloo 2 woff2 files and OFL.txt exist and are not empty", () => {
    const files = readdirSync(FONT_DIR);
    const expected = [
      "baloo-2-latin-400-normal.woff2",
      "baloo-2-latin-600-normal.woff2",
      "baloo-2-latin-700-normal.woff2",
      "baloo-2-latin-800-normal.woff2",
    ];
    for (const name of expected) {
      expect(files, name).toContain(name);
      expect(statSync(join(FONT_DIR, name)).size, name).toBeGreaterThan(0);
    }
    expect(files).toContain("OFL.txt");
    const ofl = readFileSync(join(FONT_DIR, "OFL.txt"), "utf-8");
    expect(ofl).toMatch(/SIL OPEN FONT LICENSE/i);
    expect(ofl).toMatch(/Baloo/i);
    expect(files.some((name) => name !== "OFL.txt")).toBe(true);
  });

  it("FONT-02 fonts.css declares four Baloo 2 faces with the four weights, woff2 sources and font-display swap", () => {
    const faces = fontFaces(FONTS_CSS);
    expect(faces).toHaveLength(4);
    const weights = faces
      .map((face) => /font-weight:\s*(400|600|700|800);/.exec(face.body)?.[1])
      .sort();
    expect(weights).toEqual(["400", "600", "700", "800"]);
    for (const face of faces) {
      expect(faceIsComplete(face.body), face.body).toBe(true);
    }
    expect(
      faceIsComplete(
        '@font-face { font-family: "Baloo 2"; font-style: normal; font-weight: 400; src: url("/fonts/baloo-2-latin-400-normal.woff2") format("woff2"); }',
      ),
    ).toBe(false);
  });

  it("FONT-03 the family and weight tokens resolve to Baloo 2 and are applied to body, headings and buttons", () => {
    expect(declaredTokens.get("--font-family-display")).toMatch(/^"Baloo 2"/);
    expect(declaredTokens.get("--font-family-body")).toMatch(/^"Baloo 2"/);
    expect(declaredTokens.get("--font-weight-body")).toBe("400");
    expect(declaredTokens.get("--font-weight-label")).toBe("600");
    expect(declaredTokens.get("--font-weight-heading")).toBe("800");
    const body = ruleBody(INDEX_CSS, "body");
    expect(body).toContain("font-family: var(--font-family-body)");
    expect(normalize(INDEX_CSS)).toMatch(
      /h1, h2, h3 \{[^}]*font-family: var\(--font-family-display\);[^}]*font-weight: var\(--font-weight-heading\)/,
    );
    const button = ruleBody(INDEX_CSS, "button");
    expect(button).toContain("font-family: var(--font-family-body)");
    expect(button).toContain("font-weight: var(--font-weight-heading)");
    const label = ruleBody(INDEX_CSS, "label");
    expect(label).toContain("font-family: var(--font-family-body)");
    expect(label).toContain("font-weight: var(--font-weight-label)");
    const turn = ruleBody(INDEX_CSS, ".scoreboard-turn");
    expect(turn).toContain("font-weight: var(--font-weight-label)");
  });

  it("FONT-04 the fallback stack is declared after Baloo 2 and --font-family-sans aliases the body family", () => {
    const fallback = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    expect(declaredTokens.get("--font-family-body")?.endsWith(fallback)).toBe(
      true,
    );
    expect(
      declaredTokens.get("--font-family-display")?.endsWith(fallback),
    ).toBe(true);
    expect(declaredTokens.get("--font-family-sans")).toBe(
      "var(--font-family-body)",
    );
  });

  it("SURF-01 index.css paints one shell background (glow, sheen and page gradient), declares the six category and two player remaps, and never paints body or html", () => {
    const shell = ruleBody(INDEX_CSS, ".app-shell");
    expect(shell).not.toBeNull();
    expect(shell!.match(/background-image:/g)).toHaveLength(1);
    expect(
      shell!.match(
        /linear-gradient\(\s*160deg,\s*var\(--color-page-start\),\s*var\(--color-page-end\)\s*\)/g,
      ),
    ).toHaveLength(1);
    expect(shell!).toMatch(
      /radial-gradient\([^;]*color-mix\(in srgb, var\(--color-page-glow\) 38%, transparent\)/,
    );
    expect(shell!).toContain("var(--color-page-sheen) 50%");
    expect(shell!).toContain("--color-page-glow: transparent");
    expect(shell!).toContain("--color-page-sheen: transparent");
    expect(shell!).toContain("min-height: 100dvh");
    expect(shell!).toContain("color: var(--color-on-page)");
    const body = ruleBody(INDEX_CSS, "body");
    expect(body).toContain("background-color: var(--color-page-end)");
    expect(body).not.toMatch(/background-image|linear-gradient/);
    expect(ruleBody(INDEX_CSS, "html")).toBeNull();
    expect(ruleBody(INDEX_CSS, ":root")).toBeNull();
    const categories = [
      "geografia",
      "historia",
      "ciencia",
      "arte",
      "entretenimiento",
      "deportes",
    ] as const;
    for (const name of categories) {
      const rule = ruleBody(INDEX_CSS, `[data-category-surface="${name}"]`);
      expect(rule, name).not.toBeNull();
      expect(rule!).toContain(
        `--color-page-start: var(--color-category-${name}-deep)`,
      );
      expect(rule!).toContain(
        `--color-page-glow: var(--color-category-${name})`,
      );
      expect(rule!).toContain("--color-page-sheen: var(--color-sheen-soft)");
      expect(rule!).not.toContain("--color-page-end");
    }
    expect(new Set(categories).size).toBe(6);
    for (const [surface, token] of [
      ["1", "--color-player-1"],
      ["2", "--color-player-2"],
    ] as const) {
      const rule = ruleBody(INDEX_CSS, `[data-player-surface="${surface}"]`);
      expect(rule).not.toBeNull();
      expect(rule!).toContain(`--color-page-glow: var(${token})`);
      expect(rule!).toContain("--color-page-sheen: var(--color-sheen-soft)");
      expect(rule!).not.toContain("--color-page-start");
      expect(rule!).not.toContain("--color-page-end");
    }
  });

  it("PRESS-01 the radius, shadow and animation tokens are the declared values", () => {
    const expected: ReadonlyArray<readonly [string, string]> = [
      ["--radius-pill", "999px"],
      ["--radius-card", "1.75rem"],
      ["--radius-control", "1rem"],
      ["--shadow-press", "0 1px 0 0"],
      ["--shadow-chunky", "0 4px 0 0"],
      ["--shadow-chunky-press", "0 1px 0 0"],
      ["--duration-bounce", "420ms"],
      ["--duration-icon", "360ms"],
      ["--duration-confetti", "3000ms"],
    ];
    for (const [token, value] of expected) {
      expect(declaredTokens.get(token), token).toBe(value);
    }
    expect(declaredTokens.get("--shadow-chunky")).not.toBe(
      declaredTokens.get("--shadow-chunky-press"),
    );
  });

  it("PRESS-02 every game and admin button is chunky and sinks 3 px with a shrinking solid shadow", () => {
    const button = ruleBody(INDEX_CSS, "button");
    expect(button).toContain(
      "box-shadow: var(--shadow-chunky) var(--color-action-shadow)",
    );
    expect(button).toContain("border-radius: var(--radius-control)");
    const active = ruleBody(INDEX_CSS, "button:active:not(:disabled)");
    expect(active).toContain("transform: translateY(3px)");
    expect(active).toContain(
      "box-shadow: var(--shadow-chunky-press) var(--color-action-shadow)",
    );
    const option = ruleBody(INDEX_CSS, ".option-button");
    expect(option).toContain(
      "box-shadow: var(--shadow-chunky) var(--color-control-shadow)",
    );
    const wheelSpin = ruleBody(INDEX_CSS, ".wheel-spin");
    expect(wheelSpin).toContain("text-transform: uppercase");
    expect(wheelSpin).toContain("min-width: var(--touch-target-min)");
    expect(wheelSpin).toContain("border: 2px solid var(--color-on-page)");
    const field = cssRules(INDEX_CSS).find((rule) =>
      selectorsOf(rule).includes('input:not([type="radio"])'),
    );
    expect(field).toBeDefined();
    expect(field!.body).not.toContain("--shadow-chunky");
  });

  it("PRESS-03 a disabled control drops the solid shadow and keeps its readable label", () => {
    const disabled = ruleBody(INDEX_CSS, "button:disabled");
    expect(disabled).toContain("box-shadow: none");
    expect(disabled).toContain(
      "background-color: var(--color-disabled-surface)",
    );
    expect(disabled).toContain("color: var(--color-disabled-text)");
    expect(ruleBody(INDEX_CSS, "button")).toContain(
      "box-shadow: var(--shadow-chunky) var(--color-action-shadow)",
    );
  });

  it("PLAYER-06 the two player colours never equal a category colour and stay at least 60 RGB units away", () => {
    const players = ["--color-player-1", "--color-player-2"] as const;
    const categories = [
      "--color-category-geografia",
      "--color-category-historia",
      "--color-category-ciencia",
      "--color-category-arte",
      "--color-category-entretenimiento",
      "--color-category-deportes",
    ] as const;
    const distances: number[] = [];
    for (const player of players) {
      const playerHex = declaredTokens.get(player)!;
      for (const category of categories) {
        const distance = rgbDistance(playerHex, declaredTokens.get(category)!);
        distances.push(distance);
        expect(distance, `${player} vs ${category}`).toBeGreaterThanOrEqual(60);
        expect(playerHex).not.toBe(declaredTokens.get(category));
      }
    }
    expect(Math.min(...distances)).toBeGreaterThanOrEqual(77.1);
    expect(rgbDistance("#1d4ed8", "#1d4ed8")).toBe(0);
  });

  it("TIMER-01 the timer track is at least 12 px, fully rounded, token-filled and red only when urgent", () => {
    const track = ruleBody(INDEX_CSS, ".timer-track");
    expect(track).not.toBeNull();
    expect(track!).toContain("height: 0.75rem");
    expect(track!).toContain("border-radius: var(--radius-pill)");
    const fill = ruleBody(INDEX_CSS, ".timer-fill");
    expect(fill).toContain("background-color: var(--color-timer-fill)");
    const urgent = ruleBody(INDEX_CSS, ".timer-urgent .timer-fill");
    expect(urgent).toContain("background-color: var(--color-timer-urgent)");
    expect(fill).not.toContain("--color-timer-urgent");
  });

  it("ANIM-01 the five named keyframes are declared and bound to the banner, the two icons, the sign and the pieces", () => {
    for (const name of [
      "wheel-banner-bounce",
      "result-pop",
      "result-shake",
      "sign-shine",
      "confetti-fall",
    ]) {
      expect(INDEX_CSS, name).toMatch(
        new RegExp(`@keyframes\\s+${escapeRegExp(name)}\\s*\\{`),
      );
    }
    const banner = ruleBody(INDEX_CSS, ".wheel-result");
    expect(banner).toContain("wheel-banner-bounce");
    expect(banner).toContain("var(--duration-bounce)");
    const correct = ruleBody(INDEX_CSS, ".result-icon-correct");
    expect(correct).toContain("result-pop");
    expect(correct).toContain("var(--duration-icon)");
    const wrong = ruleBody(INDEX_CSS, ".result-icon-wrong");
    expect(wrong).toContain("result-shake");
    expect(wrong).toContain("var(--duration-icon)");
    const sign = ruleBody(INDEX_CSS, ".lobby-sign::after");
    expect(sign).toContain("sign-shine");
    expect(sign).toContain("var(--duration-shine)");
    expect(sign).toContain("infinite");
    const confetti = ruleBody(INDEX_CSS, ".confetti-piece");
    expect(confetti).toContain("confetti-fall");
    expect(confetti).toContain("var(--duration-confetti)");
    expect(confetti).toContain("forwards");
  });

  it("ANIM-02 every keyframe animates only transform and opacity", () => {
    const allowed = new Set(["transform", "opacity", "translate", "scale"]);
    const keyframeNames = [...INDEX_CSS.matchAll(/@keyframes\s+([\w-]+)/g)].map(
      (match) => match[1],
    );
    expect(keyframeNames.length).toBeGreaterThanOrEqual(5);
    for (const name of keyframeNames) {
      const body = blockAfter(INDEX_CSS, `@keyframes ${name}`);
      expect(body, name).not.toBeNull();
      for (const match of body!.matchAll(/([a-z-]+)\s*:/g)) {
        expect(allowed.has(match[1]), `${name}: ${match[1]}`).toBe(true);
      }
    }
    const synthetic = blockAfter(
      "@keyframes bad { 0% { width: 1px; } 100% { width: 2px; } }",
      "@keyframes bad",
    );
    const properties = [...synthetic!.matchAll(/([a-z-]+)\s*:/g)].map(
      (match) => match[1],
    );
    expect(properties).toContain("width");
    expect(properties.some((property) => !allowed.has(property))).toBe(true);
  });

  it("ANIM-03 the reduce block hides the confetti container and zeroes every animation", () => {
    const block = blockAfter(
      INDEX_CSS,
      "@media (prefers-reduced-motion: reduce)",
    );
    expect(block).not.toBeNull();
    const normalized = normalize(block!);
    expect(normalized).toContain("animation-name: none");
    expect(normalized).toContain("animation-duration: 0s");
    expect(normalized).toContain("animation-iteration-count: 1");
    expect(normalized).toMatch(/\.game-over-confetti \{ display: none/);
  });

  it("ADMIN-01 /admin adds no font, colour or button override and inherits the game's chunky controls and focus ring", () => {
    const admin = ruleBody(INDEX_CSS, ".admin");
    expect(admin).toContain("max-width: var(--admin-max)");
    const desktop = blockAfter(INDEX_CSS, "@media (min-width: 64rem)");
    expect(desktop).not.toBeNull();
    expect(desktop).toContain(".admin-editor form");
    expect(desktop).toContain("grid-template-columns: 1fr 1fr");
    const panel = cssRules(INDEX_CSS).find((rule) =>
      selectorsOf(rule).includes(".admin-panel"),
    );
    expect(panel).toBeDefined();
    expect(panel!.body).toContain("background-color: var(--color-surface)");
    const list = cssRules(INDEX_CSS).find((rule) =>
      selectorsOf(rule).includes(".admin-list"),
    );
    expect(list).toBeDefined();
    expect(list!.body).toContain(
      "background-color: var(--color-surface-muted)",
    );
    expect(ruleBody(INDEX_CSS, "button")).toContain("--shadow-chunky");
    expect(ruleBody(INDEX_CSS, ":focus-visible")).toContain(
      "var(--color-focus-ring-halo)",
    );
    for (const rule of cssRules(INDEX_CSS)) {
      if (!rule.body.includes("font-family:")) continue;
      if (!rule.selector.includes(".admin")) continue;
      const declaration =
        /font-family:\s*([^;]+);/.exec(normalize(rule.body))?.[1] ?? "";
      expect(declaration, rule.selector).toMatch(/^var\(--font-family-/);
    }
  });

  it("GUARD-14 the Turno marker uses the player colour on the dark card", () => {
    const turn = ruleBody(INDEX_CSS, ".scoreboard-turn");
    expect(turn).not.toBeNull();
    expect(turn!).toContain("color: var(--scoreboard-player)");
    expect(turn!).not.toContain("player-deep");
    for (const [number, token] of [
      ["1", "--color-player-1"],
      ["2", "--color-player-2"],
    ] as const) {
      const card = ruleBody(INDEX_CSS, `.scoreboard-card-${number}`);
      expect(card, number).not.toBeNull();
      expect(card!).toContain(`--scoreboard-player: var(${token})`);
      expect(card!).not.toContain("--scoreboard-player-deep");
    }
  });

  it("GUARD-15 page-level actions carry the white edge and card buttons the control border", () => {
    const button = ruleBody(INDEX_CSS, "button");
    expect(button).toContain("border: 1px solid var(--color-control-border)");
    const switchButton = ruleBody(INDEX_CSS, ".switch-turn > button");
    expect(switchButton).not.toBeNull();
    expect(switchButton!).toContain("border: 2px solid var(--color-on-page)");
    const wheelContinue = ruleBody(INDEX_CSS, ".wheel-continue");
    expect(wheelContinue).not.toBeNull();
    expect(wheelContinue!).toContain("border: 2px solid var(--color-on-page)");
    const wheelSpin = ruleBody(INDEX_CSS, ".wheel-spin");
    expect(wheelSpin).toContain("border: 2px solid var(--color-on-page)");
    const option = ruleBody(INDEX_CSS, ".option-button");
    expect(option).toContain("border: 1px solid var(--color-control-border)");
  });

  it("GUARD-16 the Lobby mini wheel is a conic gradient with all six category tokens", () => {
    const mini = ruleBody(INDEX_CSS, ".lobby-mini-wheel");
    expect(mini).not.toBeNull();
    expect(mini!).toContain("conic-gradient");
    for (const name of [
      "geografia",
      "historia",
      "ciencia",
      "arte",
      "entretenimiento",
      "deportes",
    ]) {
      expect(mini!).toContain(`var(--color-category-${name})`);
    }
    expect(
      new Set(
        [...mini!.matchAll(/var\(--color-category-([a-z]+)\)/g)].map(
          (match) => match[1],
        ),
      ).size,
    ).toBe(6);
  });

  it("GUARD-17 the base button declares a font size and every primary action uses the large size", () => {
    const button = ruleBody(INDEX_CSS, "button");
    expect(button).toContain("font-size: var(--font-size-base)");
    const primary = ruleBody(INDEX_CSS, "button.button-primary");
    expect(primary).not.toBeNull();
    expect(primary!).toContain("font-size: var(--font-size-lg)");
    expect(primary!).toContain("font-weight: var(--font-weight-heading)");

    const files = [
      "Lobby.tsx",
      "Wheel.tsx",
      "Result.tsx",
      "GameOver.tsx",
      "SwitchTurn.tsx",
      "ErrorScreen.tsx",
      "AdminKeyGate.tsx",
      "AdminQuestionEditor.tsx",
    ];
    for (const file of files) {
      const source = readFileSync(join(SRC, "components", file), "utf-8");
      expect(source, file).toContain("button-primary");
    }

    const questionCard = readFileSync(
      join(SRC, "components", "QuestionCard.tsx"),
      "utf-8",
    );
    expect(questionCard).toContain(
      'className="option-button quiz-option touch-target"',
    );
    expect(questionCard).not.toContain("option-button button-primary");
  });

  it("GUARD-18 Reportar is a card-surface secondary action in the action green without a chunky shadow", () => {
    const secondary = ruleBody(INDEX_CSS, "button.button-secondary");
    expect(secondary).not.toBeNull();
    expect(secondary!).toContain("background-color: var(--color-surface)");
    expect(secondary!).toContain("border: 2px solid var(--color-action)");
    expect(secondary!).toContain("color: var(--color-action)");
    expect(secondary!).toContain("box-shadow: none");
    const hover = ruleBody(
      INDEX_CSS,
      "button.button-secondary:hover:not(:disabled)",
    );
    expect(hover).toContain("background-color: var(--color-surface-muted)");
    const active = ruleBody(
      INDEX_CSS,
      "button.button-secondary:active:not(:disabled)",
    );
    expect(active).toContain("box-shadow: none");
    const focus = ruleBody(INDEX_CSS, "button.button-secondary:focus-visible");
    expect(focus).toContain(
      "box-shadow: 0 0 0 2px var(--color-focus-ring-halo)",
    );
    expect(focus).not.toContain("shadow-chunky");
    const disabled = ruleBody(INDEX_CSS, "button.button-secondary:disabled");
    expect(disabled).toContain(
      "background-color: var(--color-disabled-surface)",
    );
    expect(disabled).toContain("color: var(--color-disabled-text)");
    expect(disabled).toContain("box-shadow: none");

    const result = readFileSync(join(SRC, "components", "Result.tsx"), "utf-8");
    expect(result).toContain('className="button-secondary touch-target"');
    expect(result).toContain(
      'className="button-primary result-continue touch-target"',
    );
  });

  it("Each letter has its own colour and the grid adapts", () => {
    const letters = ["a", "b", "c", "d"] as const;
    const used = new Set<string>();
    for (const letter of letters) {
      const rule = ruleBody(INDEX_CSS, `.quiz-option[data-option="${letter}"]`);
      expect(rule, letter).not.toBeNull();
      expect(rule!).toContain(
        `--quiz-option-color: var(--color-option-${letter})`,
      );
      used.add(letter);
    }
    expect(used.size).toBe(4);
    const option = ruleBody(
      INDEX_CSS,
      ".question-card .option-button.quiz-option",
    );
    expect(option).not.toBeNull();
    expect(option!).toContain("border: 3px solid var(--quiz-option-color)");
    expect(option!).toContain("border-radius: var(--radius-pill)");
    const badge = ruleBody(INDEX_CSS, ".quiz-letter");
    expect(badge).not.toBeNull();
    expect(badge!).toContain("background-color: var(--quiz-option-color)");
    expect(badge!).toContain("color: var(--color-on-option)");
    const grid = ruleBody(INDEX_CSS, ".option-list.quiz-options");
    expect(grid).not.toBeNull();
    expect(grid!).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(normalize(INDEX_CSS)).toMatch(
      /@media \(min-width: 48rem\) \{\s*\.option-list\.quiz-options \{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/,
    );
    const capsule = ruleBody(INDEX_CSS, ".quiz-question");
    expect(capsule).not.toBeNull();
    expect(capsule!).toMatch(
      /linear-gradient\(\s*90deg,\s*var\(--color-quiz-glow-start\),\s*var\(--color-quiz-glow-end\)\s*\)/,
    );
    expect(INDEX_CSS).not.toMatch(/quiz[^{]*::(before|after)/);
  });

  it("QUIZ-02 the base option rules still hold under the quiz capsule", () => {
    const option = ruleBody(INDEX_CSS, ".option-button");
    expect(option).toContain("border: 1px solid var(--color-control-border)");
    expect(
      compareSpecificity(
        selectorSpecificity(".question-card .option-button.quiz-option"),
        selectorSpecificity(".question-card .option-button"),
      ),
    ).toBeGreaterThan(0);
    const quiz = ruleBody(
      INDEX_CSS,
      ".question-card .option-button.quiz-option",
    );
    expect(quiz!).not.toContain("background-color");
  });

  it("ADJ-01 GIRAR is gold like the TRIVIA sign, with readable text and its own shadow", () => {
    const spin = ruleBody(INDEX_CSS, ".wheel-spin");
    expect(spin).not.toBeNull();
    expect(spin!).toMatch(
      /linear-gradient\(\s*135deg,\s*var\(--color-sign-start\),\s*var\(--color-sign-end\)\s*\)/,
    );
    expect(spin!).toContain("color: var(--color-on-sign)");
    expect(spin!).toContain(
      "box-shadow: var(--shadow-chunky) var(--color-spin-shadow)",
    );
    expect(spin!).not.toContain("--color-action");
  });

  it("ADJ-02 the wheel has a metallic rim and a fixed sheen over the canvas", () => {
    const disc = ruleBody(INDEX_CSS, ".wheel-disc");
    expect(disc).toContain("position: relative");
    expect(disc).toContain("width: 380px");
    const onlyRule = (selector: string) =>
      cssRules(INDEX_CSS).find((rule) => {
        const selectors = selectorsOf(rule);
        return selectors.length === 1 && selectors[0] === selector;
      });
    const shared = cssRules(INDEX_CSS).find((rule) => {
      const selectors = selectorsOf(rule);
      return (
        selectors.includes(".wheel-disc::before") &&
        selectors.includes(".wheel-disc::after")
      );
    });
    expect(shared).toBeDefined();
    expect(shared!.body).toContain("pointer-events: none");
    expect(shared!.body).toContain("inset: 3.16%");
    const rim = onlyRule(".wheel-disc::before");
    expect(rim).toBeDefined();
    expect(rim!.body).toContain("var(--color-metal-light)");
    expect(rim!.body).toContain("var(--color-metal-dark)");
    expect(rim!.body).toMatch(/mask-image: radial-gradient/);
    const sheen = onlyRule(".wheel-disc::after");
    expect(sheen).toBeDefined();
    expect(sheen!.body).toContain("var(--color-sheen-strong)");
    const cont = ruleBody(INDEX_CSS, ".wheel-continue");
    expect(cont).toContain("align-self: center");
    expect(cont).not.toMatch(/width: 100%/);
  });

  it("ADJ-03 the tagline is metallic, keeps a solid fallback colour and a forced-colours fallback", () => {
    const tagline = ruleBody(INDEX_CSS, ".lobby-tagline");
    expect(tagline).not.toBeNull();
    expect(tagline!).toContain("color: var(--color-metal-light)");
    expect(tagline!).toContain("background-clip: text");
    expect(tagline!).toContain("var(--color-metal-mid)");
    expect(normalize(INDEX_CSS)).toMatch(
      /@media \(forced-colors: active\) \{\s*\.lobby-tagline \{\s*-webkit-text-fill-color: CanvasText;/,
    );
    const mini = ruleBody(INDEX_CSS, ".lobby-mini-wheel");
    expect(mini!).toContain("var(--color-metal-mid)");
    expect(mini!).toContain("var(--color-sheen-strong)");
  });

  it("ADJ-04 the acting player's halo has two layers in the player colour", () => {
    const current = ruleBody(INDEX_CSS, ".scoreboard-card-current");
    expect(current).not.toBeNull();
    expect(current!).toContain("0 0 10px 1px var(--scoreboard-player)");
    expect(current!).toContain(
      "color-mix(in srgb, var(--scoreboard-player) 45%, transparent)",
    );
  });

  it("ADJ-05 the phone and landscape layouts fit the screen", () => {
    const css = normalize(INDEX_CSS);
    const phone = css.slice(css.indexOf("@media (max-width: 47.99rem)"));
    expect(phone).toContain(
      '.audio-panel:not([data-open="true"]) { display: none;',
    );
    expect(phone).toContain(
      ".audio-controls .audio-panel-toggle { display: inline-flex;",
    );
    expect(phone).toMatch(
      /\.scoreboard\[data-mode="rounds"\] \.scoreboard-list \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/,
    );
    expect(
      ruleBody(INDEX_CSS, ".audio-controls .audio-panel-toggle"),
    ).toContain("display: none");
    const landscape = css.slice(
      css.indexOf(
        "@media (orientation: landscape) and (max-height: 32rem) and (max-width: 63.99rem)",
      ),
    );
    expect(landscape).toMatch(/width: min\(380px, calc\(100dvh - 8rem\)\)/);
    expect(landscape).toMatch(/grid-template-columns: minmax\(0, 1fr\) 15rem/);
    expect(css).not.toMatch(
      /@media \(orientation: landscape\) and \(max-height: 32rem\) \{/,
    );
  });

  it("ADJ-07 the turn bubble carries the initial, a gloss and a pop that reduced motion stops", () => {
    const turn = ruleBody(INDEX_CSS, ".wheel-turn");
    expect(turn!).toContain("animation: turn-pop var(--duration-bounce)");
    expect(turn!).toContain("overflow: hidden");
    const gloss = ruleBody(INDEX_CSS, ".wheel-turn::before");
    expect(gloss).not.toBeNull();
    expect(gloss!).toContain("var(--color-sheen-strong)");
    expect(gloss!).toContain("pointer-events: none");
    for (const player of ["1", "2"] as const) {
      const initial = ruleBody(
        INDEX_CSS,
        `.wheel-turn[data-player="${player}"] .wheel-turn-initial`,
      );
      expect(initial, player).toContain(
        `background-color: var(--color-on-player-${player})`,
      );
      expect(initial, player).toContain(`color: var(--color-player-${player})`);
    }
    expect(INDEX_CSS).toMatch(/@keyframes\s+turn-pop\s*\{/);
    const wheel = readFileSync(join(SRC, "components", "Wheel.tsx"), "utf-8");
    expect(wheel).toContain(
      '<span className="wheel-turn-initial" aria-hidden="true">',
    );
  });

  it("ADJ-08 the desktop Lobby uses two columns and the large desktop widens the game", () => {
    const css = normalize(INDEX_CSS);
    const desktop = css.slice(
      css.indexOf("/* Desktop: the Lobby uses the width in two columns. */"),
    );
    expect(desktop).toMatch(
      /grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1\.4fr\)/,
    );
    expect(desktop).toContain('"sign fields" "tagline fields" "wheel fields"');
    expect(desktop).toMatch(
      /\.lobby > \.lobby-fields \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/,
    );
    const large = css.slice(css.indexOf("@media (min-width: 80rem)"));
    expect(large).toMatch(/grid-template-columns: minmax\(0, 56rem\) 22rem/);
  });

  it("The player surface is a glow on the navy page", () => {
    const rule = ruleBody(INDEX_CSS, '[data-player-surface="2"]');
    expect(rule).toContain("--color-page-glow: var(--color-player-2)");
    expect(rule).toContain("--color-page-sheen: var(--color-sheen-soft)");
    expect(rule).not.toMatch(/--color-page-(start|end)/);
  });

  it("SWC-01 the SwitchTurn card, avatar, bubble, dots and versus badge use the player colour and tokens", () => {
    const card = cssRules(INDEX_CSS).find((rule) => {
      const selectors = selectorsOf(rule);
      return (
        selectors.length === 1 &&
        selectors[0] === ".switch-turn" &&
        rule.body.includes("--switch-player")
      );
    });
    expect(card).toBeDefined();
    expect(card!.body).toContain("border: 3px solid var(--switch-player)");
    expect(card!.body).toContain("background-color: var(--color-surface)");
    expect(ruleBody(INDEX_CSS, '.switch-turn[data-player="2"]')).toContain(
      "--switch-player: var(--color-player-2)",
    );
    const avatar = ruleBody(INDEX_CSS, ".switch-turn .switch-turn-avatar");
    expect(avatar).toContain("var(--color-metal-mid)");
    expect(avatar).toContain("var(--switch-player)");
    const bubble = ruleBody(INDEX_CSS, ".switch-turn-bubble");
    expect(bubble).toContain("animation: turn-pop var(--duration-bounce)");
    expect(bubble).toContain("background-color: var(--switch-player)");
    expect(ruleBody(INDEX_CSS, ".switch-turn-bubble::before")).toContain(
      "var(--color-sheen-strong)",
    );
    expect(ruleBody(INDEX_CSS, ".round-dot.round-dot-filled")).toContain(
      "background-color: var(--color-action)",
    );
    const list = ruleBody(INDEX_CSS, ".switch-turn .scoreboard-list");
    expect(list).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
  });

  it("The versus badge is decoration only", () => {
    const badge = ruleBody(INDEX_CSS, ".switch-turn .scoreboard-list::after");
    expect(badge).not.toBeNull();
    expect(badge!).toContain('content: "VS" / ""');
    expect(badge!).toContain("pointer-events: none");
    expect(badge!).toContain("color: var(--color-on-sign)");
  });

  it("GUARD-19 the outcome icon is a visible 3.5rem block centered above the text", () => {
    const icon = ruleBody(INDEX_CSS, ".result-icon");
    expect(icon).not.toBeNull();
    expect(icon!).toContain("display: block");
    expect(icon!).not.toContain("display: none");
    expect(icon!).not.toContain("opacity: 0");
    expect(icon!).toContain("width: 3.5rem");
    expect(icon!).toContain("min-width: 3.5rem");
    expect(icon!).toContain("height: 3.5rem");
    expect(icon!).toContain("min-height: 3.5rem");
    const outcome = ruleBody(INDEX_CSS, ".result-outcome");
    expect(outcome).not.toBeNull();
    expect(outcome!).toContain("flex-direction: column");
    expect(outcome!).toContain("align-items: center");
    expect(outcome!).toContain("text-align: center");
    const result = readFileSync(join(SRC, "components", "Result.tsx"), "utf-8");
    expect(result).toContain("<ResultIcon kind={iconKind} />");
    expect(result.indexOf("<ResultIcon kind={iconKind} />")).toBeLessThan(
      result.indexOf("<span>{outcomeLabel(lastAnswer, m)}</span>"),
    );
  });

  it("GUARD-20 the question text uses the 3xl scale, body family and 1.5 line-height", () => {
    const text = ruleBody(INDEX_CSS, ".question-text");
    expect(text).not.toBeNull();
    expect(text!).toContain("font-family: var(--font-family-body)");
    expect(text!).toContain("font-size: var(--font-size-3xl)");
    expect(text!).toContain("font-weight: var(--font-weight-label)");
    expect(text!).toContain("line-height: 1.5");
    const questionCard = readFileSync(
      join(SRC, "components", "QuestionCard.tsx"),
      "utf-8",
    );
    expect(questionCard).toContain('<h2 className="question-text">');
    const result = readFileSync(join(SRC, "components", "Result.tsx"), "utf-8");
    expect(result).toContain('<p className="question-text">');
  });

  it("GUARD-21 the turn banner is a title-sized centered pill and the wheel subtitle is centered", () => {
    const turn = ruleBody(INDEX_CSS, ".wheel-turn");
    expect(turn).not.toBeNull();
    expect(turn!).toContain("background-color: var(--color-player-1)");
    expect(turn!).toContain("color: var(--color-on-player-1)");
    expect(turn!).toContain("font-size: var(--font-size-3xl)");
    expect(turn!).toContain("font-weight: var(--font-weight-heading)");
    expect(turn!).toContain("text-align: center");
    expect(turn!).toContain("border-radius: var(--radius-pill)");
    const subtitle = ruleBody(INDEX_CSS, ".wheel .game-main > h2");
    expect(subtitle).not.toBeNull();
    expect(subtitle!).toContain("text-align: center");
    expect(subtitle!).toContain("font-size: var(--font-size-xl)");
  });

  it("GUARD-22 the application shell leaves top breathing room at every width", () => {
    const shell = ruleBody(INDEX_CSS, ".app-shell");
    expect(shell).not.toBeNull();
    expect(shell!).toContain("padding-block: var(--spacing-4)");
  });

  it("GUARD-23 the wheel shrinks with phones narrower than the 380px canvas", () => {
    const stage = ruleBody(INDEX_CSS, ".wheel-stage");
    expect(stage).not.toBeNull();
    expect(stage!).toContain("grid-template-columns: minmax(0, 1fr)");
    const disc = ruleBody(INDEX_CSS, ".wheel-disc");
    expect(disc).not.toBeNull();
    expect(disc!).toContain("max-width: 100%");
    const canvas = ruleBody(INDEX_CSS, ".wheel-canvas");
    expect(canvas).not.toBeNull();
    expect(canvas!).toContain("max-width: 100%");
  });

  it("GUARD-24 buttons never grow wider than the screen, even with large text", () => {
    const button = ruleBody(INDEX_CSS, "\nbutton");
    expect(button).not.toBeNull();
    expect(button!).toContain("max-width: 100%");
    expect(button!).toContain("overflow-wrap: anywhere");
    expect(ruleBody(INDEX_CSS, ".wheel-continue")!).toContain(
      "min-width: min(12rem, 100%)",
    );
    expect(ruleBody(INDEX_CSS, ".switch-turn > button")!).toContain(
      "min-width: min(14rem, 100%)",
    );
    for (const selector of [".surrender", ".surrender-confirm"]) {
      const rule = ruleBody(INDEX_CSS, `\n${selector}`);
      expect(rule).not.toBeNull();
      expect(rule!).toContain("min-width: 0");
      expect(rule!).toContain("max-width: 100%");
    }
  });
});
