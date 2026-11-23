import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ModeCrownIcon } from "./ModeCrownIcon";

describe("ModeCrownIcon", () => {
  it("MCI-01 draws a decorative crown with its animated parts", () => {
    const { container } = render(<ModeCrownIcon />);
    const svg = container.querySelector("svg.mode-crown");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("focusable", "false");
    for (const part of [
      ".crown-shadow",
      ".crown-body",
      ".crown-beam",
      ".crown-pearls",
    ]) {
      expect(container.querySelector(part), part).not.toBeNull();
    }
    expect(container.querySelectorAll(".crown-pearls circle")).toHaveLength(5);
    expect(container.querySelectorAll(".crown-spark")).toHaveLength(2);
  });

  it("MCI-02 every colour comes from a token", () => {
    const { container } = render(<ModeCrownIcon />);
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}["; ]/);
    expect(container.innerHTML).not.toMatch(/rgba?\(/);
    const stops = [...container.querySelectorAll("stop")];
    expect(stops.length).toBeGreaterThan(20);
    for (const stop of stops) {
      expect(stop.getAttribute("style")).toMatch(
        /stop-color: var\(--color-[a-z0-9-]+\)/,
      );
    }
  });

  it("MCI-03 two crowns never share gradient or clip ids", () => {
    const { container } = render(
      <>
        <ModeCrownIcon />
        <ModeCrownIcon />
      </>,
    );
    const ids = [...container.querySelectorAll("[id]")].map((node) => node.id);
    expect(ids.length).toBeGreaterThan(20);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
