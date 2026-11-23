import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { installRafQueue } from "../test/rafQueue";
import { ModeFlagIcon } from "./ModeFlagIcon";
import { motionAllowed } from "./useFlagWave";

function allowMotion(allowed: boolean): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query.includes("no-preference") ? allowed : !allowed,
    })),
  );
}

function cloth(container: HTMLElement): string[] {
  return [
    ...container.querySelectorAll(".flag-check-light, .flag-check-dark"),
  ].map((cell) => cell.getAttribute("d") ?? "");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ModeFlagIcon", () => {
  it("MFI-01 draws a decorative pole, knob and a checkered cloth of 8 by 5 cells", () => {
    const { container } = render(<ModeFlagIcon active={false} />);
    const svg = container.querySelector("svg.mode-flag");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("focusable", "false");
    expect(container.querySelectorAll(".flag-check-light")).toHaveLength(20);
    expect(container.querySelectorAll(".flag-check-dark")).toHaveLength(20);
    expect(container.querySelector(".flag-cloth-edge")).not.toBeNull();
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b(?!-)/);
  });

  it("MFI-02 two flags never share gradient ids", () => {
    const { container } = render(
      <>
        <ModeFlagIcon active={false} />
        <ModeFlagIcon active={false} />
      </>,
    );
    const ids = [...container.querySelectorAll("[id]")].map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("MFI-03 a selected flag waves for a few seconds, then rests in its first pose", () => {
    allowMotion(true);
    const queue = installRafQueue();
    const { container } = render(<ModeFlagIcon active />);
    const rest = cloth(container);
    expect(queue.pending()).toBe(1);

    act(() => queue.runFrame(1000));
    act(() => queue.runFrame(1500));
    expect(cloth(container)).not.toEqual(rest);

    act(() => queue.runFrame(1000 + 3700));
    expect(queue.pending()).toBe(0);
    expect(cloth(container)).toEqual(rest);
  });

  it("MFI-04 without the motion permission the flag never schedules a frame", () => {
    const queue = installRafQueue();
    render(<ModeFlagIcon active />);
    expect(queue.pending()).toBe(0);

    allowMotion(false);
    render(<ModeFlagIcon active />);
    expect(queue.pending()).toBe(0);
    expect(motionAllowed()).toBe(false);
  });

  it("MFI-05 an unselected flag stays still and leaving the mode stops the wave", () => {
    allowMotion(true);
    const queue = installRafQueue();
    const { container, rerender } = render(<ModeFlagIcon active={false} />);
    expect(queue.pending()).toBe(0);
    const rest = cloth(container);

    rerender(<ModeFlagIcon active />);
    act(() => queue.runFrame(0));
    act(() => queue.runFrame(700));
    expect(cloth(container)).not.toEqual(rest);

    rerender(<ModeFlagIcon active={false} />);
    expect(cancelAnimationFrame).toHaveBeenCalled();
    expect(cloth(container)).toEqual(rest);
  });

  it("MFI-06 motion is allowed only when the browser confirms no preference", () => {
    expect(motionAllowed()).toBe(false);
    allowMotion(true);
    expect(motionAllowed()).toBe(true);
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true })),
    );
    expect(motionAllowed()).toBe(false);
  });
});
