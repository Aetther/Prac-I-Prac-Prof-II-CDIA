import type { Lang } from "../game/types";
import {
  cellPath,
  columnShade,
  edgeBetween,
  outlinePath,
  stripTransform,
  waveEdges,
} from "./flagWave";
import type { WaveEdge } from "./flagWave";
import { useFlagWave } from "./useFlagWave";

const WIDTH = 30;
const HEIGHT = 20;
const COLUMNS = 10;
const AMPLITUDE = 2;
const COLUMN_WIDTH = WIDTH / COLUMNS;

type FlagColour = "red" | "yellow" | "blue" | "white";

/** A flat, non-overlapping colour area of a flag. */
interface Region {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly colour: FlagColour;
}

const STRIPE_HEIGHT = HEIGHT / 7;
const CANTON_WIDTH = 16;
const CANTON_HEIGHT = STRIPE_HEIGHT * 4;

const SPAIN: readonly Region[] = [
  { x: 0, y: 0, width: WIDTH, height: 5, colour: "red" },
  { x: 0, y: 5, width: WIDTH, height: 10, colour: "yellow" },
  { x: 0, y: 15, width: WIDTH, height: 5, colour: "red" },
];

/** Stripes beside the canton, the canton, then the full stripes below it. */
const UNITED_STATES: readonly Region[] = [
  ...[0, 1, 2, 3].map((stripe): Region => ({
    x: CANTON_WIDTH,
    y: stripe * STRIPE_HEIGHT,
    width: WIDTH - CANTON_WIDTH,
    height: STRIPE_HEIGHT,
    colour: stripe % 2 === 0 ? "red" : "white",
  })),
  { x: 0, y: 0, width: CANTON_WIDTH, height: CANTON_HEIGHT, colour: "blue" },
  ...[4, 5, 6].map((stripe): Region => ({
    x: 0,
    y: stripe * STRIPE_HEIGHT,
    width: WIDTH,
    height: STRIPE_HEIGHT,
    colour: stripe % 2 === 0 ? "red" : "white",
  })),
];

const DOTS = [
  [3, 2.5],
  [8, 2.5],
  [13, 2.5],
  [3, 7],
  [8, 7],
  [13, 7],
] as const;

/**
 * Each region cut along the column edges into four-sided pieces that follow
 * the wave. Pieces never overlap, so no colour bleeds through a seam.
 */
function regionPieces(regions: readonly Region[], edges: readonly WaveEdge[]) {
  const pieces = [];
  for (const [index, region] of regions.entries()) {
    for (let column = 0; column < COLUMNS; column += 1) {
      const x0 = column * COLUMN_WIDTH;
      const x1 = x0 + COLUMN_WIDTH;
      const from = Math.max(region.x, x0);
      const to = Math.min(region.x + region.width, x1);
      if (to <= from) continue;
      const left = edgeBetween(from, x0, x1, edges[column], edges[column + 1]);
      const right = edgeBetween(to, x0, x1, edges[column], edges[column + 1]);
      pieces.push(
        <path
          key={`${index}-${column}`}
          className={`flag-piece flag-${region.colour}`}
          d={cellPath(
            from,
            to,
            region.y,
            region.y + region.height,
            left,
            right,
          )}
        />,
      );
    }
  }
  return pieces;
}

/** A dot follows the column that holds its centre. */
function dotTransform(cx: number, edges: readonly WaveEdge[]): string {
  const column = Math.min(COLUMNS - 1, Math.floor(cx / COLUMN_WIDTH));
  return stripTransform(
    column * COLUMN_WIDTH,
    (column + 1) * COLUMN_WIDTH,
    edges[column],
    edges[column + 1],
  );
}

/**
 * Original, simplified flags drawn for this game: Spain as red-yellow-red
 * bands, the United States as stripes with a canton of dots. The selected
 * language's flag waves for a few cycles, like the rounds-mode flag.
 * Decorative only.
 */
export function FlagIcon({
  language,
  waving = false,
}: {
  language: Lang;
  waving?: boolean;
}) {
  const time = useFlagWave(waving);
  const edges = waveEdges(COLUMNS, time, AMPLITUDE);
  const columns = Array.from({ length: COLUMNS }, (_, index) => index);

  return (
    <svg
      className="flag-icon"
      viewBox="-1 -3 32 26"
      aria-hidden="true"
      focusable="false"
      data-flag={language}
    >
      {regionPieces(language === "es" ? SPAIN : UNITED_STATES, edges)}
      {language === "en"
        ? DOTS.map(([cx, cy]) => (
            <circle
              key={`${cx}-${cy}`}
              className="flag-white"
              cx={cx}
              cy={cy}
              r="1.1"
              transform={dotTransform(cx, edges)}
            />
          ))
        : null}
      {columns.map((column) => {
        const shade = columnShade(edges[column], edges[column + 1], AMPLITUDE);
        if (shade === 1) return null;
        return (
          <path
            key={column}
            className={shade < 1 ? "flag-shade-dark" : "flag-shade-light"}
            fillOpacity={Math.abs(1 - shade).toFixed(3)}
            d={cellPath(
              column * COLUMN_WIDTH,
              (column + 1) * COLUMN_WIDTH,
              0,
              HEIGHT,
              edges[column],
              edges[column + 1],
            )}
          />
        );
      })}
      <path
        className="flag-icon-edge"
        d={outlinePath(0, WIDTH, 0, HEIGHT, edges)}
      />
    </svg>
  );
}
