import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import type { WheelCategory } from "../game/category";
import type { Player } from "../game/types";
import {
  INITIAL_WHEEL_ROTATION,
  createSpinPlan,
  normalizeAngle,
  sectorIndexAtRotation,
} from "../game/wheel";
import { installCanvasHarness } from "../test/canvasHarness";
import type { CanvasHarness } from "../test/canvasHarness";
import { installRafQueue } from "../test/rafQueue";
import type { RafQueue } from "../test/rafQueue";
import {
  EXPECTED_24_TICKS,
  FRAME_TIMESTAMPS,
  SENTINEL_TOKENS,
  SIX_WHEEL_CATEGORIES,
} from "../test/wheelFixtures";
import { Wheel } from "./Wheel";

const PLAYERS: readonly [Player, Player] = [
  { name: "Ana", score: 0 },
  { name: "Beto", score: 0 },
];

const SECTOR_SENTINELS = [
  "sentinel-geografia",
  "sentinel-historia",
  "sentinel-ciencia",
  "sentinel-arte",
  "sentinel-entretenimiento",
  "sentinel-deportes",
];

type WheelProps = ComponentProps<typeof Wheel>;

const roundsProgress = {
  mode: "rounds",
  round: 1,
  totalRounds: 3,
} as const;

let canvas: CanvasHarness;
let queue: RafQueue;

function renderWheel(overrides: Partial<WheelProps> = {}) {
  const onChooseCategory = vi.fn();
  const onSectorCross = vi.fn();
  const view = render(
    <Wheel
      categories={SIX_WHEEL_CATEGORIES}
      players={PLAYERS}
      currentPlayer={0}
      progress={roundsProgress}
      onChooseCategory={onChooseCategory}
      onSectorCross={onSectorCross}
      {...overrides}
    />,
  );
  return { ...view, onChooseCategory, onSectorCross };
}

function startSpin(): void {
  fireEvent.click(screen.getByRole("button", { name: "Girar" }));
}

async function drive(
  timestamps: readonly number[] = FRAME_TIMESTAMPS,
): Promise<void> {
  await act(async () => {
    queue.drive(timestamps);
  });
}

async function spin(
  timestamps: readonly number[] = FRAME_TIMESTAMPS,
): Promise<void> {
  startSpin();
  await drive(timestamps);
}

function sectorArcs() {
  const radii = canvas.arcs.map((arc) => arc.r);
  const outerRadius = Math.max(...radii);
  const sectorRadius = Math.max(...radii.filter((r) => r !== outerRadius));
  return canvas.arcs.filter((arc) => arc.r === sectorRadius).slice(-6);
}

function drawnRotation(): number {
  return sectorArcs()[0].start + Math.PI / 2;
}

beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0);
  canvas = installCanvasHarness();
  queue = installRafQueue();
  for (const [token, value] of Object.entries(SENTINEL_TOKENS)) {
    document.documentElement.style.setProperty(token, value);
  }
});

afterEach(() => {
  for (const token of Object.keys(SENTINEL_TOKENS)) {
    document.documentElement.style.removeProperty(token);
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Wheel", () => {
  it("renders the heading, scoreboard, canvas role and the exact label description", () => {
    renderWheel();

    expect(
      screen.getByRole("heading", { name: "Girá la ruleta" }),
    ).toBeVisible();
    const canvasElement = screen.getByRole("img", {
      name: "Ruleta de categorías",
    });
    expect(canvasElement.tagName).toBe("CANVAS");
    expect(canvasElement).toHaveAccessibleDescription(
      "Geografía, Historia, Ciencia, Arte, Entretenimiento, Deportes.",
    );
    expect(screen.getByText("Ana: 0 puntos")).toBeVisible();
    expect(screen.getByText("Beto: 0 puntos")).toBeVisible();

    const current = screen
      .getAllByRole("listitem")
      .filter((item) => item.getAttribute("aria-current") === "true");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent("Ana: 0 puntos");
    expect(screen.getAllByText("Turno")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Girar" })).toHaveClass(
      "touch-target",
    );
  });

  it("draws the six sectors with the token colours in declared order", () => {
    renderWheel();

    const sectorFills = canvas.fillsAtFill.filter((fill) =>
      SECTOR_SENTINELS.includes(fill),
    );

    expect(sectorFills).toEqual(SECTOR_SENTINELS);
    expect(new Set(sectorFills).size).toBe(6);
    expect(canvas.fillsAtFill.length).toBeGreaterThanOrEqual(6);
  });

  it("draws every API label with the label token colour", () => {
    const labels = [
      "Etiqueta 1",
      "Etiqueta 2",
      "Etiqueta 3",
      "Etiqueta 4",
      "Etiqueta 5",
      "Etiqueta 6",
    ];
    const categories: WheelCategory[] = SIX_WHEEL_CATEGORIES.map(
      (category, index) => ({ ...category, label: labels[index] }),
    );

    renderWheel({ categories });

    const drawnLabels = canvas.texts.slice(0, 6);
    expect(drawnLabels.map((text) => text.text)).toEqual(labels);
    for (const text of drawnLabels) {
      expect(text.style).toBe("sentinel-label");
      expect(text.font).toContain("sentinel-font");
    }
  });

  it("paints the pointer, hub, stroke and label with their wheel tokens", () => {
    renderWheel();

    expect(canvas.fillsAtFill).toContain("sentinel-hub");
    expect(canvas.fillsAtFill).toContain("sentinel-pointer");
    expect(canvas.fillsAtFill).toContain("sentinel-rim");
    expect(canvas.strokesAtStroke).toContain("sentinel-stroke");
    expect(canvas.texts.length).toBeGreaterThanOrEqual(6);
    for (const text of canvas.texts) {
      expect(text.style).toBe("sentinel-label");
    }
    for (const role of [
      "sentinel-pointer",
      "sentinel-rim",
      "sentinel-label",
      "sentinel-hub",
      "sentinel-stroke",
    ]) {
      expect(SECTOR_SENTINELS).not.toContain(role);
    }
  });

  it("draws a 6 px rim in the rim token and keeps it inside the canvas", () => {
    renderWheel();

    const radii = [...new Set(canvas.arcs.map((arc) => arc.r))];
    const outerRadius = Math.max(...radii);
    const sectorRadius = Math.max(...radii.filter((r) => r !== outerRadius));

    expect(outerRadius).toBe(148);
    expect(sectorRadius).toBe(142);
    expect(outerRadius - sectorRadius).toBe(6);
    expect(160 - outerRadius).toBe(12);
    expect(canvas.fillsAtFill).toContain("sentinel-rim");
    expect(canvas.fillsAtFill.indexOf("sentinel-rim")).toBeLessThan(
      canvas.fillsAtFill.indexOf("sentinel-geografia"),
    );
    expect(canvas.arcs.filter((arc) => arc.r === sectorRadius)).toHaveLength(6);
  });

  it("draws a 32 × 26 pointer whose tip enters 10 px into the sectors", () => {
    renderWheel();

    const tip = canvas.moves.find((point) => point.x === 0 && point.y !== 0);
    const base = canvas.lines.filter((point) => Math.abs(point.x) === 16);

    expect(tip).toBeDefined();
    expect(base).toHaveLength(2);
    expect(base[0].y).toBe(base[1].y);

    const baseY = base[0].y;
    const tipY = tip!.y;
    expect(base[0].x).toBe(-16);
    expect(base[1].x).toBe(16);
    expect(baseY).toBe(-158);
    expect(160 + baseY).toBe(2);
    expect(tipY - baseY).toBe(26);
    expect(baseY).toBeLessThan(-148);
    expect(tipY).toBeGreaterThan(-148);
    expect(tipY).toBeGreaterThan(-142);
    expect(tipY + 142).toBe(10);
    expect(
      canvas.fillsAtFill.filter((fill) => fill === "sentinel-pointer"),
    ).not.toHaveLength(0);
  });

  it("keeps the sector under the pointer unchanged", () => {
    renderWheel();

    const pointer = -Math.PI / 2;
    const containing = sectorArcs()
      .map((arc, index) => ({
        index,
        offset: normalizeAngle(pointer - arc.start),
        width: arc.end - arc.start,
      }))
      .filter((arc) => arc.offset < arc.width);

    expect(containing).toHaveLength(1);
    expect(containing[0].index).toBe(
      sectorIndexAtRotation(INITIAL_WHEEL_ROTATION),
    );
    expect(containing[0].index).toBe(0);
  });

  it("shows Girando... and disables Girar while the spin runs", async () => {
    renderWheel();

    startSpin();
    await drive([0]);

    expect(screen.getByText("Girando...")).toBeVisible();
    expect(screen.getByText("Girando...")).toHaveClass("wheel-status");
    expect(screen.getByText("Girando...")).not.toHaveClass(
      "wheel-status-result",
    );
    expect(screen.getByRole("button", { name: "Girar" })).toBeDisabled();

    await drive([3750]);
    expect(screen.getByRole("button", { name: "Girar" })).toBeDisabled();

    await drive([4000]);
    expect(screen.getByRole("status").textContent).toBe("Salió: Geografía");
    expect(screen.queryByRole("button", { name: "Girar" })).toBeNull();
  });

  it("runs for exactly 4000 ms and draws the planned end rotation", async () => {
    renderWheel();

    startSpin();
    await drive([0, 3999]);

    expect(screen.queryByText(/Salió:/)).toBeNull();
    expect(screen.getByRole("button", { name: "Girar" })).toBeDisabled();

    await drive([4000]);

    expect(screen.getByRole("status").textContent).toBe("Salió: Geografía");
    const plan = createSpinPlan(INITIAL_WHEEL_ROTATION, () => 0);
    const rotation = drawnRotation();
    expect(sectorArcs()).toHaveLength(6);
    expect(rotation).toBeCloseTo(plan.endRotation, 6);
    expect(rotation).toBeLessThanOrEqual(plan.endRotation + 1e-9);
  });

  it("emits one tick per crossed sector, 24 in the frozen plan", async () => {
    const { onSectorCross } = renderWheel();

    await spin();

    expect(onSectorCross).toHaveBeenCalledTimes(24);
    const payloads = onSectorCross.mock.calls.map(([tick]) => tick);
    expect(payloads).toEqual(EXPECTED_24_TICKS);
    expect(payloads[0]).toEqual({ sectorIndex: 5, category: "deportes" });
    expect(payloads[23]).toEqual({ sectorIndex: 0, category: "geografia" });
  });

  it("emits no tick before the spin or after the result", async () => {
    const { onSectorCross } = renderWheel();
    expect(onSectorCross).toHaveBeenCalledTimes(0);

    await spin();

    expect(onSectorCross).toHaveBeenCalledTimes(24);
    expect(queue.pending()).toBe(0);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onSectorCross).toHaveBeenCalledTimes(24);
    expect(screen.getByRole("status").textContent).toBe("Salió: Geografía");
  });

  it("matches the last tick to the shown result and the confirmed category", async () => {
    const { onChooseCategory, onSectorCross } = renderWheel();

    await spin();

    const lastTick = onSectorCross.mock.calls.at(-1)?.[0];
    expect(lastTick).toEqual({ sectorIndex: 0, category: "geografia" });
    expect(screen.getByRole("status").textContent).toBe("Salió: Geografía");
    expect(onChooseCategory).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    expect(onChooseCategory).toHaveBeenCalledTimes(1);
    expect(onChooseCategory).toHaveBeenCalledWith("geografia");
  });

  it("shows Salió in a status region and waits for Continuar", async () => {
    const { onChooseCategory } = renderWheel();

    await spin();

    const status = screen.getByRole("status");
    expect(status.textContent).toBe("Salió: Geografía");
    expect(status).toHaveClass("wheel-status", "wheel-status-result");
    const continuar = screen.getByRole("button", { name: "Continuar" });
    expect(continuar).toHaveClass("touch-target");
    expect(continuar).toBeVisible();
    expect(onChooseCategory).not.toHaveBeenCalled();

    fireEvent.click(continuar);

    expect(onChooseCategory).toHaveBeenCalledTimes(1);
    expect(onChooseCategory).toHaveBeenCalledWith("geografia");
  });

  it("starts one plan for two clicks in the same tick", async () => {
    const { onSectorCross } = renderWheel();
    const spinButton = screen.getByRole("button", { name: "Girar" });

    act(() => {
      fireEvent.click(spinButton);
      fireEvent.click(spinButton);
    });

    expect(queue.pending()).toBe(1);

    await drive();

    expect(onSectorCross).toHaveBeenCalledTimes(24);
    expect(screen.getAllByText(/Salió:/)).toHaveLength(1);
  });

  it("survives a null 2D context and still reaches the result", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => null,
    );
    const { onSectorCross } = renderWheel();

    await spin();

    expect(screen.getByRole("status").textContent).toBe("Salió: Geografía");
    expect(screen.getByRole("button", { name: "Continuar" })).toBeVisible();
    expect(onSectorCross).toHaveBeenCalledTimes(24);
  });

  it("cancels the pending frame on unmount", () => {
    const { unmount } = renderWheel();

    startSpin();
    const pendingId = queue.lastScheduledId();
    unmount();

    expect(vi.mocked(cancelAnimationFrame)).toHaveBeenCalledWith(pendingId);
  });

  it("completes the spin when onSectorCross is omitted", async () => {
    renderWheel({ onSectorCross: undefined });

    await spin();

    expect(screen.getByRole("status").textContent).toBe("Salió: Geografía");
    expect(screen.getByRole("button", { name: "Continuar" })).toBeVisible();
  });

  it("draws more than half the rotation at half the duration", async () => {
    renderWheel();

    startSpin();
    await drive([0, 2000]);

    const plan = createSpinPlan(INITIAL_WHEEL_ROTATION, () => 0);
    const progress =
      (drawnRotation() - plan.startRotation) /
      (plan.endRotation - plan.startRotation);

    expect(progress).toBeGreaterThan(0.5);
    expect(progress).toBeCloseTo(0.875, 3);
  });

  it("emits the ticks without constructing an AudioContext", async () => {
    const audioSpy = vi.fn();
    vi.stubGlobal("AudioContext", audioSpy);
    const { onSectorCross } = renderWheel();

    await spin();

    expect(onSectorCross).toHaveBeenCalledTimes(24);
    expect(audioSpy).not.toHaveBeenCalled();
  });

  it("shows Deportes at 6000 ms when the plan draws the maximum duration", async () => {
    vi.mocked(Math.random).mockReturnValue(1);
    renderWheel();

    startSpin();
    await drive([0, 5999]);

    expect(screen.queryByText(/Salió:/)).toBeNull();
    expect(screen.getByRole("button", { name: "Girar" })).toBeDisabled();

    await drive([6000]);

    expect(screen.getByRole("status").textContent).toBe("Salió: Deportes");
    expect(screen.queryByRole("button", { name: "Girar" })).toBeNull();
  });

  it("renders Girar and Continuar as touch-target buttons", async () => {
    renderWheel();

    expect(screen.getByRole("button", { name: "Girar" })).toHaveClass(
      "touch-target",
    );

    await spin();

    const continuar = screen.getByRole("button", { name: "Continuar" });
    expect(continuar).toHaveClass("touch-target");
    expect(continuar).toBeVisible();
  });

  it("draws the sector computed by sectorIndexAtRotation under the pointer", async () => {
    renderWheel();

    await spin();

    const pointer = -Math.PI / 2;
    const containing = sectorArcs()
      .map((arc, index) => ({
        index,
        offset: normalizeAngle(pointer - arc.start),
        width: arc.end - arc.start,
      }))
      .filter((arc) => arc.offset < arc.width);

    expect(containing).toHaveLength(1);
    const plan = createSpinPlan(INITIAL_WHEEL_ROTATION, () => 0);
    expect(containing[0].index).toBe(sectorIndexAtRotation(plan.endRotation));
    expect(containing[0].index).toBe(0);
  });

  it("derives the text alternative from the label props", () => {
    const first = SIX_WHEEL_CATEGORIES.map((category, index) => ({
      ...category,
      label: `Etiqueta ${index + 1}`,
    }));
    const second = SIX_WHEEL_CATEGORIES.map((category, index) => ({
      ...category,
      label: `Otra ${index + 1}`,
    }));
    const { onChooseCategory, onSectorCross, rerender } = renderWheel({
      categories: first,
    });

    expect(screen.getByRole("img")).toHaveAccessibleDescription(
      "Etiqueta 1, Etiqueta 2, Etiqueta 3, Etiqueta 4, Etiqueta 5, Etiqueta 6.",
    );

    rerender(
      <Wheel
        categories={second}
        players={PLAYERS}
        currentPlayer={0}
        progress={roundsProgress}
        onChooseCategory={onChooseCategory}
        onSectorCross={onSectorCross}
      />,
    );

    expect(screen.getByRole("img")).toHaveAccessibleDescription(
      "Otra 1, Otra 2, Otra 3, Otra 4, Otra 5, Otra 6.",
    );
  });

  it("renders a canvas element and no SVG", () => {
    const { container } = renderWheel();

    const canvasElement = screen.getByRole("img");
    expect(canvasElement.tagName).toBe("CANVAS");
    expect(container.querySelector("svg")).toBeNull();
    expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalled();
  });

  it("uses a 320 × dpr backing store and scales the context", async () => {
    const dprSpy = vi.spyOn(window, "devicePixelRatio", "get");
    const cases = [
      { dpr: 1, expected: 320, transform: [1, 0, 0, 1, 0, 0] },
      { dpr: 2, expected: 640, transform: [2, 0, 0, 2, 0, 0] },
      { dpr: 4, expected: 960, transform: [3, 0, 0, 3, 0, 0] },
      { dpr: 0, expected: 320, transform: [1, 0, 0, 1, 0, 0] },
      {
        dpr: undefined,
        expected: 320,
        transform: [1, 0, 0, 1, 0, 0],
      },
    ];

    for (const { dpr, expected, transform } of cases) {
      dprSpy.mockReturnValue(dpr as number);
      const { unmount } = renderWheel();
      const canvasElement = screen.getByRole("img", {
        name: "Ruleta de categorías",
      }) as HTMLCanvasElement;

      expect(canvasElement).toHaveClass("wheel-canvas");
      expect(canvasElement.width).toBe(expected);
      expect(canvasElement.height).toBe(expected);
      expect(canvas.transforms.at(-1)).toEqual(transform);
      expect(canvas.clearRect).toHaveBeenLastCalledWith(0, 0, 320, 320);
      expect(canvas.translate).toHaveBeenLastCalledWith(160, 160);
      const maxRadius = Math.max(...canvas.arcs.map((arc) => arc.r));
      expect(maxRadius).toBe(148);
      expect(160 - maxRadius).toBe(12);
      const sectorRadius = Math.max(
        ...canvas.arcs.map((arc) => arc.r).filter((r) => r !== maxRadius),
      );
      expect(sectorRadius).toBe(142);

      startSpin();
      await drive([0]);
      expect(canvas.transforms.at(-1)).toEqual(transform);
      expect(canvas.scale).not.toHaveBeenCalled();

      unmount();
      queue.frames.length = 0;
    }
  });

  it("WUI-23 a six-mode Wheel shows the six scoreboard and no round", () => {
    const { container } = renderWheel({
      progress: {
        mode: "six-categories",
        ownedCategories: [["geografia"], []],
        turnsPlayed: [2, 0],
      },
    });

    expect(
      screen.getByRole("heading", { name: "Girá la ruleta" }),
    ).toBeVisible();
    expect(screen.getByRole("img")).toHaveAccessibleDescription(
      "Geografía, Historia, Ciencia, Arte, Entretenimiento, Deportes.",
    );
    expect(screen.getByText("Límite: 20 turnos por jugador")).toBeVisible();
    expect(screen.getByText("Categorías: 1 de 6")).toBeVisible();
    expect(screen.getByText("Turnos: 2 de 20")).toBeVisible();
    expect(container.textContent).not.toMatch(/Ronda \d+ de \d+/);
    expect(container.textContent).not.toMatch(/puntos/i);
    expect(document.querySelectorAll('[aria-current="true"]')).toHaveLength(1);
  });
});
