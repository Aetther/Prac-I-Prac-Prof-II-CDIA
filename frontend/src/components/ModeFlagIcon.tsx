import { useId } from "react";
import { cellPath, columnShade, outlinePath, waveEdges } from "./flagWave";
import { stopToken } from "./svgPaint";
import { useFlagWave } from "./useFlagWave";

const COLUMNS = 8;
const ROWS = 5;
const CLOTH_X = 12;
const CLOTH_Y = 9;
const CLOTH_WIDTH = 46;
const CLOTH_HEIGHT = 28;
const AMPLITUDE = 3.6;

/**
 * The checkered flag of the rounds mode: a metal pole with a gold knob and a
 * cloth that waves for a few cycles when the mode is selected. Decorative.
 */
export function ModeFlagIcon({ active }: { active: boolean }) {
  const id = useId();
  const time = useFlagWave(active);
  const edges = waveEdges(COLUMNS, time, AMPLITUDE);
  const cellWidth = CLOTH_WIDTH / COLUMNS;
  const cellHeight = CLOTH_HEIGHT / ROWS;

  const cells = [];
  const shades = [];
  for (let column = 0; column < COLUMNS; column += 1) {
    const left = edges[column];
    const right = edges[column + 1];
    const x0 = CLOTH_X + column * cellWidth;
    const x1 = x0 + cellWidth;
    for (let row = 0; row < ROWS; row += 1) {
      const y0 = CLOTH_Y + row * cellHeight;
      cells.push(
        <path
          key={`${column}-${row}`}
          className={
            (column + row) % 2 === 1 ? "flag-check-dark" : "flag-check-light"
          }
          d={cellPath(x0, x1, y0, y0 + cellHeight, left, right)}
        />,
      );
    }
    const shade = columnShade(left, right, AMPLITUDE);
    if (shade !== 1) {
      shades.push(
        <path
          key={column}
          className={shade < 1 ? "flag-shade-dark" : "flag-shade-light"}
          fillOpacity={Math.abs(1 - shade).toFixed(3)}
          d={cellPath(x0, x1, CLOTH_Y, CLOTH_Y + CLOTH_HEIGHT, left, right)}
        />,
      );
    }
  }

  return (
    <svg
      className="mode-flag"
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${id}-pole`} x1="0" x2="1">
          <stop offset="0" style={stopToken("pole-mid")} />
          <stop offset="0.45" style={stopToken("metal-light")} />
          <stop offset="1" style={stopToken("metal-dark")} />
        </linearGradient>
        <radialGradient id={`${id}-knob`} cx="0.35" cy="0.35" r="0.7">
          <stop offset="0" style={stopToken("knob-light")} />
          <stop offset="0.6" style={stopToken("sign-start")} />
          <stop offset="1" style={stopToken("knob-deep")} />
        </radialGradient>
      </defs>
      <g className="flag-sway">
        <rect
          x="7.5"
          y="5"
          width="4.5"
          height="56"
          rx="2.2"
          fill={`url(#${id}-pole)`}
        />
        <circle cx="9.75" cy="5" r="3.6" fill={`url(#${id}-knob)`} />
        <g className="flag-cloth">
          {cells}
          {shades}
          <path
            className="flag-cloth-edge"
            d={outlinePath(CLOTH_X, CLOTH_WIDTH, CLOTH_Y, CLOTH_HEIGHT, edges)}
          />
        </g>
      </g>
    </svg>
  );
}
