// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  WAVE_CYCLES,
  WAVE_DURATION,
  WAVE_PERIOD,
  WAVE_REST_TIME,
  cellPath,
  columnShade,
  edgeBetween,
  outlinePath,
  stripTransform,
  waveEdges,
} from "./flagWave";

describe("flag wave", () => {
  it("FW-01 a selection waves three whole cycles, under five seconds", () => {
    expect(WAVE_CYCLES).toBe(3);
    expect(WAVE_DURATION).toBeCloseTo(3 * WAVE_PERIOD, 10);
    expect(WAVE_DURATION).toBeLessThan(5);
  });

  it("FW-02 the edge at the pole never moves and the wave grows towards the free end", () => {
    const edges = waveEdges(8, 1.1, 3.6);
    expect(edges).toHaveLength(9);
    expect(edges[0].dx).toBeCloseTo(0, 10);
    expect(edges[0].dy).toBeCloseTo(0, 10);
    for (const edge of edges) {
      expect(Math.abs(edge.dy)).toBeLessThanOrEqual(3.6 + 1e-9);
      expect(edge.dx).toBeLessThanOrEqual(1e-9);
    }
  });

  it("FW-03 the pose repeats after one period, so the wave ends at rest", () => {
    const rest = waveEdges(8, WAVE_REST_TIME, 3.6);
    const end = waveEdges(8, WAVE_REST_TIME + WAVE_DURATION, 3.6);
    rest.forEach((edge, index) => {
      expect(end[index].dx).toBeCloseTo(edge.dx, 6);
      expect(end[index].dy).toBeCloseTo(edge.dy, 6);
    });
  });

  it("FW-04 the column shade stays between 0.62 and 1.08", () => {
    for (let time = 0; time < WAVE_PERIOD; time += 0.05) {
      const edges = waveEdges(8, time, 3.6);
      for (let index = 0; index < 8; index += 1) {
        const shade = columnShade(edges[index], edges[index + 1], 3.6);
        expect(shade).toBeGreaterThanOrEqual(0.62);
        expect(shade).toBeLessThanOrEqual(1.08);
      }
    }
    const flat = { dx: 0, dy: 0, slope: 0 };
    expect(columnShade(flat, flat, 3.6)).toBe(1);
  });

  it("FW-05 a cell path joins the four moved corners", () => {
    const left = { dx: 0, dy: 1, slope: 0 };
    const right = { dx: -0.5, dy: -1, slope: 0 };
    expect(cellPath(10, 20, 0, 5, left, right)).toBe(
      "M10.00 1.00L19.50 -1.00L19.50 4.00L10.00 6.00Z",
    );
  });

  it("FW-08 an edge between two column edges blends them by its position", () => {
    const left = { dx: 0, dy: 2, slope: 1 };
    const right = { dx: -1, dy: -2, slope: 3 };
    expect(edgeBetween(10, 10, 14, left, right)).toEqual(left);
    expect(edgeBetween(14, 10, 14, left, right)).toEqual(right);
    expect(edgeBetween(11, 10, 14, left, right)).toEqual({
      dx: -0.25,
      dy: 1,
      slope: 1.5,
    });
  });

  it("FW-06 the outline runs along the top and back along the bottom", () => {
    const flat = waveEdges(2, 0, 0);
    expect(outlinePath(0, 30, 0, 20, flat)).toBe(
      "M0.00 0.00 L15.00 0.00 L30.00 0.00 L30.00 20.00 L15.00 20.00 L0.00 20.00Z",
    );
  });

  it("FW-07 the strip matrix maps the strip corners onto the moved edges", () => {
    const left = { dx: -0.2, dy: 0.5, slope: 0 };
    const right = { dx: -0.6, dy: -1, slope: 0 };
    const matrix = stripTransform(9, 12, left, right);
    const [a, b, c, d, e, f] = matrix
      .slice("matrix(".length, -1)
      .split(" ")
      .map(Number);
    const apply = (x: number, y: number) => [
      a * x + c * y + e,
      b * x + d * y + f,
    ];
    const [lx, ly] = apply(9, 4);
    const [rx, ry] = apply(12, 4);
    expect(lx).toBeCloseTo(9 - 0.2, 3);
    expect(ly).toBeCloseTo(4 + 0.5, 3);
    expect(rx).toBeCloseTo(12 - 0.6, 3);
    expect(ry).toBeCloseTo(4 - 1, 3);
    expect(
      stripTransform(
        0,
        3,
        { dx: 0, dy: 0, slope: 0 },
        { dx: 0, dy: 0, slope: 0 },
      ),
    ).toBe("matrix(1 0 0 1 0 0)");
  });
});
