import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { installRafQueue } from "../test/rafQueue";
import { FlagIcon } from "./FlagIcon";

afterEach(() => {
  vi.unstubAllGlobals();
});

function pieces(container: HTMLElement): string[] {
  return [...container.querySelectorAll(".flag-piece")].map(
    (piece) => piece.getAttribute("d") ?? "",
  );
}

function allowMotion(): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({ matches: query.includes("no-preference") })),
  );
}

describe("FlagIcon", () => {
  it("FLAG-01 each flag is decorative, keeps its data-flag and needs no clip paths", () => {
    for (const language of ["es", "en"] as const) {
      const { container, unmount } = render(<FlagIcon language={language} />);
      const svg = container.querySelector("svg.flag-icon");
      expect(svg).toHaveAttribute("aria-hidden", "true");
      expect(svg).toHaveAttribute("data-flag", language);
      expect(container.querySelectorAll("clipPath")).toHaveLength(0);
      expect(container.querySelectorAll("[id]")).toHaveLength(0);
      expect(container.querySelector(".flag-icon-edge")).not.toBeNull();
      unmount();
    }
  });

  it("FLAG-02 the Spanish bands and the US stripes, canton and dots are cut into wave pieces", () => {
    const es = render(<FlagIcon language="es" />);
    expect(es.container.querySelectorAll(".flag-piece.flag-red")).toHaveLength(
      20,
    );
    expect(
      es.container.querySelectorAll(".flag-piece.flag-yellow"),
    ).toHaveLength(10);
    expect(es.container.querySelectorAll("circle")).toHaveLength(0);
    es.unmount();

    const en = render(<FlagIcon language="en" />);
    // The canton spans 16 of 30 units: 6 columns, the last one shared.
    expect(en.container.querySelectorAll(".flag-piece.flag-blue")).toHaveLength(
      6,
    );
    expect(en.container.querySelectorAll("circle.flag-white")).toHaveLength(6);
    expect(
      en.container.querySelectorAll(".flag-piece.flag-red").length,
    ).toBeGreaterThan(0);
    expect(
      en.container.querySelectorAll(".flag-piece.flag-white").length,
    ).toBeGreaterThan(0);
  });

  it("FLAG-03 no two pieces of a flag cover the same column twice in one region", () => {
    const { container } = render(<FlagIcon language="en" />);
    const paths = pieces(container);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("FLAG-04 the selected language's flag waves and then rests", () => {
    allowMotion();
    const queue = installRafQueue();
    const { container } = render(<FlagIcon language="es" waving />);
    const rest = pieces(container);
    expect(queue.pending()).toBe(1);
    act(() => queue.runFrame(0));
    act(() => queue.runFrame(800));
    expect(pieces(container)).not.toEqual(rest);
    act(() => queue.runFrame(5000));
    expect(queue.pending()).toBe(0);
    expect(pieces(container)).toEqual(rest);
  });

  it("FLAG-05 a flag that is not selected never schedules a frame", () => {
    allowMotion();
    const queue = installRafQueue();
    render(<FlagIcon language="en" />);
    expect(queue.pending()).toBe(0);
  });
});
