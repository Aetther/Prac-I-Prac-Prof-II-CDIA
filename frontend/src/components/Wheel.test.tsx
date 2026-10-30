import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { CATEGORY_EMOJI, findCategoryEmoji } from "../game/category";
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

    expect(screen.getByText("¡Turno de Ana!")).toBeVisible();
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
      "wheel-spin",
    );
  });

  it('COPY-01 the Wheel shows "¡Turno de Ana!" and the "¡Geografía!" result and never "Salió:"', async () => {
    const { onChooseCategory } = renderWheel();

    expect(screen.getByText("¡Turno de Ana!")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Girá la ruleta" }),
    ).toBeVisible();

    await spin();

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("¡Geografía!");
    expect(status.closest("section")?.textContent).not.toContain("Salió:");

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(onChooseCategory).toHaveBeenCalledWith("geografia");
  });

  it('COPY-05 the round "Girar" control keeps the accessible name "Girar" and the wheel-spin class', async () => {
    renderWheel();

    const button = screen.getByRole("button", { name: "Girar" });
    expect(button).toHaveClass("wheel-spin", "touch-target");
    expect(button.textContent).toBe("Girar");
    expect(button).toBeEnabled();

    startSpin();
    await drive([0]);
    expect(screen.getByRole("button", { name: "Girar" })).toBeDisabled();
  });

  it("EMOJI-02 the canvas draws each emoji beside its label, paints no hub and keeps the description emoji-free", () => {
    renderWheel();

    const labels = SIX_WHEEL_CATEGORIES.map((category) => category.label);
    const emojis = SIX_WHEEL_CATEGORIES.map((category) =>
      findCategoryEmoji(category.name),
    );
    const labelTexts = canvas.texts.filter((text) =>
      labels.includes(text.text),
    );
    const emojiTexts = canvas.texts.filter((text) =>
      emojis.includes(text.text),
    );

    expect(labelTexts).toHaveLength(6);
    expect(emojiTexts).toHaveLength(6);
    expect(canvas.measureText).toHaveBeenCalled();
    for (let index = 0; index < 6; index += 1) {
      const label = labelTexts[index];
      const emoji = emojiTexts[index];
      const labelWidth = label.text.length * 7;
      const emojiWidth = emoji.text.length * 7;
      const labelLeft = label.x - labelWidth;
      const emojiLeft = emoji.x - emojiWidth;
      expect(emoji.x).not.toBe(label.x);
      expect(emoji.textAlign).toBe("right");
      expect(label.textAlign).toBe("right");
      expect(emojiLeft + emojiWidth).toBeLessThanOrEqual(labelLeft - 12);
      expect(emoji.style).toBe(label.style);
    }
    for (const text of canvas.texts) {
      const hasLabel = labels.some((label) => text.text.includes(label));
      const hasEmoji = emojis.some((emoji) => text.text.includes(emoji));
      expect(hasLabel && hasEmoji).toBe(false);
    }
    expect(
      [...new Set(canvas.arcs.map((arc) => arc.r))].sort((a, b) => b - a),
    ).toEqual([178, 172]);
    expect(
      screen.getByRole("img", { name: "Ruleta de categorías" }),
    ).toHaveAccessibleDescription(
      "Geografía, Historia, Ciencia, Arte, Entretenimiento, Deportes.",
    );
    expect(canvas.fillsAtFill).toContain("sentinel-pointer");
  });

  it('EMOJI-03 the wheel result banner shows the aria-hidden emoji and the exact "¡Geografía!" text', async () => {
    renderWheel();

    await spin();

    const status = screen.getByRole("status");
    expect(status).toHaveClass("wheel-result");
    expect(status).toHaveAttribute("data-category", "geografia");
    const emoji = within(status).getByText("🌎");
    expect(emoji).toHaveAttribute("aria-hidden", "true");
    const label = within(status).getByText("¡Geografía!");
    expect(label).not.toBe(emoji);
    expect(status.textContent).toBe("🌎¡Geografía!");
    expect(document.body.textContent).not.toContain("Salió: Geografía");
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

  it("draws every API label and its emoji with the label token colour", () => {
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

    const drawnLabels = canvas.texts.filter((text) =>
      labels.includes(text.text),
    );
    const emojis = SIX_WHEEL_CATEGORIES.map(
      (category) => CATEGORY_EMOJI[category.name],
    );
    const drawnEmojis = canvas.texts.filter((text) =>
      emojis.includes(text.text),
    );

    expect(drawnLabels.map((text) => text.text)).toEqual(labels);
    expect(drawnEmojis.map((text) => text.text)).toEqual(emojis);
    for (const text of [...drawnLabels, ...drawnEmojis]) {
      expect(text.style).toBe("sentinel-label");
      expect(text.font).toContain("sentinel-font");
    }
  });

  it("paints the pointer, rim, stroke and labels with their wheel tokens and no hub", () => {
    renderWheel();

    expect(canvas.fillsAtFill).toContain("sentinel-pointer");
    expect(canvas.fillsAtFill).toContain("sentinel-rim");
    expect(canvas.strokesAtStroke).toContain("sentinel-stroke");
    expect(canvas.fillsAtFill).not.toContain("sentinel-hub");
    expect(canvas.arcs.some((arc) => arc.r === 24)).toBe(false);
    expect(canvas.texts.length).toBeGreaterThanOrEqual(6);
    for (const text of canvas.texts) {
      expect(text.style).toBe("sentinel-label");
    }
    for (const role of [
      "sentinel-pointer",
      "sentinel-rim",
      "sentinel-label",
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

    expect(outerRadius).toBe(178);
    expect(sectorRadius).toBe(172);
    expect(outerRadius - sectorRadius).toBe(6);
    expect(190 - outerRadius).toBe(12);
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
    expect(baseY).toBe(-188);
    expect(190 + baseY).toBe(2);
    expect(tipY - baseY).toBe(26);
    expect(baseY).toBeLessThan(-178);
    expect(tipY).toBeGreaterThan(-178);
    expect(tipY).toBeGreaterThan(-172);
    expect(tipY + 172).toBe(10);
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
    expect(screen.getByRole("status")).toHaveTextContent("¡Geografía!");
    expect(screen.queryByRole("button", { name: "Girar" })).toBeNull();
  });

  it("runs for exactly 4000 ms and draws the planned end rotation", async () => {
    renderWheel();

    startSpin();
    await drive([0, 3999]);

    expect(screen.queryByText(/¡Geografía!/)).toBeNull();
    expect(screen.getByRole("button", { name: "Girar" })).toBeDisabled();

    await drive([4000]);

    expect(screen.getByRole("status")).toHaveTextContent("¡Geografía!");
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
    expect(screen.getByRole("status")).toHaveTextContent("¡Geografía!");
  });

  it("matches the last tick to the shown result and the confirmed category", async () => {
    const { onChooseCategory, onSectorCross } = renderWheel();

    await spin();

    const lastTick = onSectorCross.mock.calls.at(-1)?.[0];
    expect(lastTick).toEqual({ sectorIndex: 0, category: "geografia" });
    expect(screen.getByRole("status")).toHaveTextContent("¡Geografía!");
    expect(onChooseCategory).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    expect(onChooseCategory).toHaveBeenCalledTimes(1);
    expect(onChooseCategory).toHaveBeenCalledWith("geografia");
  });

  it("shows ¡Geografía! in a status region and waits for Continuar", async () => {
    const { onChooseCategory } = renderWheel();

    await spin();

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("¡Geografía!");
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
    expect(screen.getAllByText(/¡Geografía!/)).toHaveLength(1);
  });

  it("survives a null 2D context and still reaches the result", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => null,
    );
    const { onSectorCross } = renderWheel();

    await spin();

    expect(screen.getByRole("status")).toHaveTextContent("¡Geografía!");
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

    expect(screen.getByRole("status")).toHaveTextContent("¡Geografía!");
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

    expect(screen.queryByText(/¡Geografía!/)).toBeNull();
    expect(screen.getByRole("button", { name: "Girar" })).toBeDisabled();

    await drive([6000]);

    expect(screen.getByRole("status")).toHaveTextContent("¡Deportes!");
    expect(screen.queryByRole("button", { name: "Girar" })).toBeNull();
  });

  it("renders Girar and Continuar as touch-target buttons", async () => {
    renderWheel();

    expect(screen.getByRole("button", { name: "Girar" })).toHaveClass(
      "button-primary",
      "touch-target",
    );

    await spin();

    const continuar = screen.getByRole("button", { name: "Continuar" });
    expect(continuar).toHaveClass("button-primary", "touch-target");
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

  it("uses a 380 × dpr backing store and scales the context", async () => {
    const dprSpy = vi.spyOn(window, "devicePixelRatio", "get");
    const cases = [
      { dpr: 1, expected: 380, transform: [1, 0, 0, 1, 0, 0] },
      { dpr: 2, expected: 760, transform: [2, 0, 0, 2, 0, 0] },
      { dpr: 4, expected: 1140, transform: [3, 0, 0, 3, 0, 0] },
      { dpr: 0, expected: 380, transform: [1, 0, 0, 1, 0, 0] },
      {
        dpr: undefined,
        expected: 380,
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
      expect(canvas.clearRect).toHaveBeenLastCalledWith(0, 0, 380, 380);
      expect(canvas.translate).toHaveBeenLastCalledWith(190, 190);
      const maxRadius = Math.max(...canvas.arcs.map((arc) => arc.r));
      expect(maxRadius).toBe(178);
      expect(190 - maxRadius).toBe(12);
      const sectorRadius = Math.max(
        ...canvas.arcs.map((arc) => arc.r).filter((r) => r !== maxRadius),
      );
      expect(sectorRadius).toBe(172);

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

  it("WUI-24 the Wheel is a game-layout with the scoreboard rail before the canvas in game-main", () => {
    renderWheel();

    const heading = screen.getByRole("heading", { name: "Girá la ruleta" });
    const section = heading.closest("section");
    expect(section).not.toBeNull();
    expect(section).toHaveClass("wheel", "game-layout");

    const rails = section!.querySelectorAll<HTMLElement>(".scoreboard-rail");
    const mains = section!.querySelectorAll<HTMLElement>(".game-main");
    expect(rails).toHaveLength(1);
    expect(mains).toHaveLength(1);
    const rail = rails[0];
    const main = mains[0];

    expect(rail.parentElement).toBe(section);
    expect(main.parentElement).toBe(section);
    expect(
      rail.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    const canvas = screen.getByRole("img", {
      name: "Ruleta de categorías",
    });
    expect(main).toContainElement(canvas);
    expect(main).toContainElement(heading);
    expect(main).toContainElement(
      screen.getByRole("button", { name: "Girar" }),
    );

    // Positive control: containment is checked in both directions.
    expect(rail).not.toContainElement(canvas);
    expect(main).not.toContainElement(rail);
  });

  it("WUI-25 a reduced-motion spin ends at 1200 ms, shows Geografía and emits six sector ticks", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true })),
    );
    const { onSectorCross } = renderWheel();

    startSpin();
    await drive([0, 1199]);

    expect(screen.queryByText(/¡Geografía!/)).toBeNull();
    expect(screen.getByRole("button", { name: "Girar" })).toBeDisabled();

    await drive([1200]);

    expect(screen.getByRole("status")).toHaveTextContent("¡Geografía!");
    expect(onSectorCross).toHaveBeenCalledTimes(6);
    const payloads = onSectorCross.mock.calls.map(([tick]) => tick);
    expect(payloads).toEqual([
      { sectorIndex: 5, category: "deportes" },
      { sectorIndex: 4, category: "entretenimiento" },
      { sectorIndex: 3, category: "arte" },
      { sectorIndex: 2, category: "ciencia" },
      { sectorIndex: 1, category: "historia" },
      { sectorIndex: 0, category: "geografia" },
    ]);
    expect(payloads.at(-1)).toEqual({
      sectorIndex: 0,
      category: "geografia",
    });
  });

  it("WUI-26 the wheel reads prefers-reduced-motion when the spin starts, not at mount", async () => {
    const matchMedia = vi.fn(() => ({ matches: false }));
    vi.stubGlobal("matchMedia", matchMedia);
    const first = renderWheel();

    expect(matchMedia).toHaveBeenCalledTimes(0);

    startSpin();

    expect(matchMedia).toHaveBeenCalledTimes(1);
    expect(matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");

    first.unmount();
    queue.frames.length = 0;
    matchMedia.mockReturnValue({ matches: true });
    renderWheel();

    startSpin();
    await drive([0, 1199]);
    expect(screen.queryByText(/¡Geografía!/)).toBeNull();
    await drive([1200]);
    expect(screen.getByRole("status")).toHaveTextContent("¡Geografía!");
  });

  it("WUI-27 a missing matchMedia falls back to the default 4000 ms plan", async () => {
    const cases: ReadonlyArray<() => void> = [
      () => {
        vi.stubGlobal("matchMedia", undefined);
      },
      () => {
        vi.stubGlobal("matchMedia", () => undefined);
      },
    ];

    for (const stub of cases) {
      stub();
      const view = renderWheel();
      const { onSectorCross } = view;

      await spin();

      expect(screen.getByRole("status")).toHaveTextContent("¡Geografía!");
      expect(onSectorCross).toHaveBeenCalledTimes(24);

      view.unmount();
      queue.frames.length = 0;
    }
  });
});
