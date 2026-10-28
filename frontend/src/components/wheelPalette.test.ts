// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { readWheelPalette } from "./wheelPalette";

const TOKEN_NAMES = [
  "--color-category-geografia",
  "--color-category-historia",
  "--color-category-ciencia",
  "--color-category-arte",
  "--color-category-entretenimiento",
  "--color-category-deportes",
  "--color-wheel-pointer",
  "--color-wheel-label",
  "--color-wheel-stroke",
] as const;

function readTokens(): Map<string, string> {
  const css = readFileSync(
    join(process.cwd(), "src/styles/tokens.css"),
    "utf-8",
  );
  const tokens = new Map<string, string>();
  for (const match of css.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/gi)) {
    tokens.set(match[1], match[2].trim());
  }
  return tokens;
}

function channel(value: number): number {
  const scaled = value / 255;
  return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const red = parseInt(hex.slice(1, 3), 16);
  const green = parseInt(hex.slice(3, 5), 16);
  const blue = parseInt(hex.slice(5, 7), 16);
  return (
    0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue)
  );
}

function contrast(first: string, second: string): number {
  const lighter = Math.max(luminance(first), luminance(second));
  const darker = Math.min(luminance(first), luminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

describe("wheel palette", () => {
  it("reads the nine wheel tokens and trims every value", () => {
    const calls: string[] = [];
    const style = {
      getPropertyValue(name: string): string {
        calls.push(name);
        return `  sentinel-${name.slice(2)}  `;
      },
    };

    const palette = readWheelPalette(style);

    expect(palette).toEqual({
      sector: {
        geografia: "sentinel-color-category-geografia",
        historia: "sentinel-color-category-historia",
        ciencia: "sentinel-color-category-ciencia",
        arte: "sentinel-color-category-arte",
        entretenimiento: "sentinel-color-category-entretenimiento",
        deportes: "sentinel-color-category-deportes",
      },
      pointer: "sentinel-color-wheel-pointer",
      label: "sentinel-color-wheel-label",
      stroke: "sentinel-color-wheel-stroke",
    });
    expect(calls).toEqual([...TOKEN_NAMES]);
  });

  it("maps the six tokens declared in tokens.css to the sector palette in declared order", () => {
    const tokens = readTokens();
    const palette = readWheelPalette({
      getPropertyValue: (name) => tokens.get(name) ?? "",
    });

    expect(palette).toEqual({
      sector: {
        geografia: "#1d4ed8",
        historia: "#b45309",
        ciencia: "#0f766e",
        arte: "#7e22ce",
        entretenimiento: "#be185d",
        deportes: "#15803d",
      },
      pointer: "#111827",
      label: "#ffffff",
      stroke: "#ffffff",
    });
    expect(new Set(Object.values(palette.sector)).size).toBe(6);
  });

  it("keeps white label contrast at or above 4.5 to 1 on all six sector colours", () => {
    const tokens = readTokens();
    const palette = readWheelPalette({
      getPropertyValue: (name) => tokens.get(name) ?? "",
    });

    const ratios = Object.values(palette.sector).map((colour) =>
      contrast(colour, palette.label),
    );
    for (const ratio of ratios) {
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
    expect(new Set(Object.values(palette.sector)).size).toBe(6);
  });

  it("returns an empty string for a missing token instead of inventing a colour", () => {
    const tokens = readTokens();
    const palette = readWheelPalette({
      getPropertyValue: (name) =>
        name === "--color-category-arte" ? "" : (tokens.get(name) ?? ""),
    });

    expect(palette.sector.arte).toBe("");
    expect(palette.sector.geografia).toBe("#1d4ed8");
    expect(palette.sector.historia).toBe("#b45309");
    expect(palette.sector.ciencia).toBe("#0f766e");
    expect(palette.sector.entretenimiento).toBe("#be185d");
    expect(palette.sector.deportes).toBe("#15803d");
  });
});
