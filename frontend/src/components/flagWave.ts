/**
 * The waving cloth shared by the Lobby flags: the checkered flag of the rounds
 * mode and the two language flags. A flag is cut into vertical columns; each
 * column edge moves and tilts with a travelling sine wave that grows towards
 * the free end of the cloth, and each column is shaded by how much it tilts.
 */

/** One vertical edge of the cloth: how far it moves and how steep it is. */
export interface WaveEdge {
  readonly dx: number;
  readonly dy: number;
  readonly slope: number;
}

/** Radians per second of the travelling wave. */
export const WAVE_SPEED = 5.2;
export const WAVE_PERIOD = (2 * Math.PI) / WAVE_SPEED;
/** The pose a still flag keeps, slightly waved so it never looks flat. */
export const WAVE_REST_TIME = 0.35;
/** A selection waves the flag for three whole cycles and ends at rest. */
export const WAVE_CYCLES = 3;
export const WAVE_DURATION = WAVE_CYCLES * WAVE_PERIOD;

const PHASE_ACROSS = 6.8;
const PULL_BACK = 0.39;
const SHADE_TILT = 0.432;
const SHADE_SLOPE = 0.072;
const SHADE_MIN = 0.62;
const SHADE_MAX = 1.08;

/** The columns + 1 edges of a cloth at a time in seconds. */
export function waveEdges(
  columns: number,
  time: number,
  amplitude: number,
): WaveEdge[] {
  const edges: WaveEdge[] = [];
  for (let index = 0; index <= columns; index += 1) {
    const across = index / columns;
    const reach = amplitude * across;
    const phase = across * PHASE_ACROSS - time * WAVE_SPEED;
    edges.push({
      dx: -amplitude * PULL_BACK * across * (1 - Math.cos(phase)) * 0.5,
      dy: reach * Math.sin(phase),
      slope: reach * Math.cos(phase),
    });
  }
  return edges;
}

/** How bright the column between two edges is: below 1 darker, above lighter. */
export function columnShade(
  left: WaveEdge,
  right: WaveEdge,
  amplitude: number,
): number {
  const tilt = (right.dy - left.dy) / amplitude;
  const shade = 1 - tilt * SHADE_TILT + (left.slope / amplitude) * SHADE_SLOPE;
  return Math.min(SHADE_MAX, Math.max(SHADE_MIN, shade));
}

function fixed(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

/** The four-sided path of a cloth cell between two moved column edges. */
export function cellPath(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  left: WaveEdge,
  right: WaveEdge,
): string {
  const lx = x0 + left.dx;
  const rx = x1 + right.dx;
  return (
    `M${fixed(lx)} ${fixed(y0 + left.dy)}` +
    `L${fixed(rx)} ${fixed(y0 + right.dy)}` +
    `L${fixed(rx)} ${fixed(y1 + right.dy)}` +
    `L${fixed(lx)} ${fixed(y1 + left.dy)}Z`
  );
}

/** The wave edge at any x between two column edges, by straight blending. */
export function edgeBetween(
  x: number,
  x0: number,
  x1: number,
  left: WaveEdge,
  right: WaveEdge,
): WaveEdge {
  const t = (x - x0) / (x1 - x0);
  return {
    dx: left.dx + (right.dx - left.dx) * t,
    dy: left.dy + (right.dy - left.dy) * t,
    slope: left.slope + (right.slope - left.slope) * t,
  };
}

/** The outline of the whole moved cloth, for its edge stroke. */
export function outlinePath(
  x0: number,
  width: number,
  y0: number,
  height: number,
  edges: readonly WaveEdge[],
): string {
  const columns = edges.length - 1;
  const top = edges.map(
    (edge, index) =>
      `${fixed(x0 + (index * width) / columns + edge.dx)} ${fixed(y0 + edge.dy)}`,
  );
  const bottom = edges
    .map(
      (edge, index) =>
        `${fixed(x0 + (index * width) / columns + edge.dx)} ${fixed(y0 + height + edge.dy)}`,
    )
    .reverse();
  return `M${top.join(" L")} L${bottom.join(" L")}Z`;
}

/**
 * The SVG matrix that bends the strip x0..x1 of a flat drawing so its left
 * edge follows one wave edge and its right edge the next one.
 */
export function stripTransform(
  x0: number,
  x1: number,
  left: WaveEdge,
  right: WaveEdge,
): string {
  const width = x1 - x0;
  const stretch = (right.dx - left.dx) / width;
  const skew = (right.dy - left.dy) / width;
  const a = 1 + stretch;
  const e = left.dx - x0 * stretch;
  const f = left.dy - x0 * skew;
  return `matrix(${[a, skew, 0, 1, e, f].map((value) => Number(value.toFixed(4))).join(" ")})`;
}
