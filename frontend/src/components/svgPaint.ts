import type { CSSProperties } from "react";

/** SVG paint from a colour token, so no colour literal lives in a component. */
export function fillToken(token: string): CSSProperties {
  return { fill: `var(--color-${token})` };
}

export function strokeToken(token: string): CSSProperties {
  return { stroke: `var(--color-${token})` };
}

export function stopToken(token: string, opacity?: number): CSSProperties {
  return opacity === undefined
    ? { stopColor: `var(--color-${token})` }
    : { stopColor: `var(--color-${token})`, stopOpacity: opacity };
}
