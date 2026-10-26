import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { Timer } from "./Timer";

const NOW = new Date("2026-10-25T12:00:00Z");

function renderTimer(seconds: number) {
  const onExpire = vi.fn();
  const view = render(<Timer seconds={seconds} onExpire={onExpire} />);
  return { ...view, onExpire };
}

function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function fillWidth(container: HTMLElement): number {
  const fill = container.querySelector(".timer-fill");
  expect(fill).not.toBeNull();
  return Number.parseFloat((fill as HTMLElement).style.width);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("Timer", () => {
  it("TUI-01 shows the full time, the progressbar and no urgent state at mount", () => {
    const { container } = renderTimer(20);

    expect(
      screen.getByRole("timer", { name: "Tiempo restante" }).textContent,
    ).toBe("20 s");
    const progressbar = screen.getByRole("progressbar", {
      name: "Tiempo restante",
    });
    expect(progressbar).toHaveAttribute("aria-valuemin", "0");
    expect(progressbar).toHaveAttribute("aria-valuemax", "20");
    expect(progressbar).toHaveAttribute("aria-valuenow", "20");
    expect(fillWidth(container)).toBe(100);
    expect(container.querySelector(".timer")).not.toHaveAttribute(
      "data-urgent",
    );
    expect(screen.queryByText("Últimos 5 segundos")).toBeNull();
  });

  it("TUI-02 uses the configured 10 and 30 seconds", () => {
    const ten = renderTimer(10);

    expect(
      screen.getByRole("progressbar", { name: "Tiempo restante" }),
    ).toHaveAttribute("aria-valuemax", "10");
    expect(screen.getByRole("timer").textContent).toBe("10 s");
    ten.unmount();

    renderTimer(30);

    expect(
      screen.getByRole("progressbar", { name: "Tiempo restante" }),
    ).toHaveAttribute("aria-valuemax", "30");
    expect(screen.getByRole("timer").textContent).toBe("30 s");
  });

  it("TUI-03 decreases after three seconds", () => {
    const { container, onExpire } = renderTimer(20);

    advance(3_000);

    expect(screen.getByRole("timer").textContent).toBe("17 s");
    expect(
      screen.getByRole("progressbar", { name: "Tiempo restante" }),
    ).toHaveAttribute("aria-valuenow", "17");
    const width = fillWidth(container);
    expect(width).toBeGreaterThanOrEqual(80);
    expect(width).toBeLessThanOrEqual(90);
    expect(container.querySelector(".timer")).not.toHaveAttribute(
      "data-urgent",
    );
    expect(onExpire).not.toHaveBeenCalled();
  });

  it("TUI-04 turns urgent exactly at five seconds", () => {
    const { container } = renderTimer(20);

    advance(14_000);

    expect(screen.getByRole("timer").textContent).toBe("6 s");
    expect(container.querySelector(".timer")).not.toHaveAttribute(
      "data-urgent",
    );
    expect(screen.queryByText("Últimos 5 segundos")).toBeNull();

    advance(1_000);

    expect(screen.getByRole("timer").textContent).toBe("5 s");
    const timer = container.querySelector(".timer");
    expect(timer).toHaveAttribute("data-urgent", "true");
    expect(timer).toHaveClass("timer-urgent");
    expect(screen.getByText("Últimos 5 segundos")).toBeVisible();
  });

  it("TUI-05 exposes the remaining value through ARIA", () => {
    renderTimer(20);

    expect(
      screen.getByRole("timer", { name: "Tiempo restante" }).textContent,
    ).toBe("20 s");
    expect(
      screen.getByRole("progressbar", { name: "Tiempo restante" }),
    ).toHaveAttribute("aria-valuenow", "20");

    advance(8_000);

    expect(
      screen.getByRole("progressbar", { name: "Tiempo restante" }),
    ).toHaveAttribute("aria-valuenow", "12");
    expect(screen.queryByText("Últimos 5 segundos")).toBeNull();
  });

  it("TUI-06 calls onExpire once at zero and never again", () => {
    const { container, onExpire } = renderTimer(20);

    advance(19_750);
    expect(onExpire).not.toHaveBeenCalled();

    advance(250);
    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(fillWidth(container)).toBe(0);

    advance(10_000);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("TUI-07 clears its interval on unmount", () => {
    const { onExpire, unmount } = renderTimer(20);

    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
    advance(10_000);
    expect(onExpire).not.toHaveBeenCalled();
  });

  it("TUI-08 keeps the fill proportional to the remaining fraction", () => {
    const { container } = renderTimer(10);

    advance(2_500);
    expect(fillWidth(container)).toBe(75);
    expect(screen.getByRole("timer").textContent).toBe("8 s");

    advance(2_500);
    expect(fillWidth(container)).toBe(50);

    advance(5_000);
    expect(fillWidth(container)).toBe(0);
  });
});
