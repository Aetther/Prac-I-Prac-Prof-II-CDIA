import type { PlayerIndex } from "../game/types";

export function playerInitial(name: string): string {
  const trimmed = name.trim();
  if (trimmed === "") return "";
  return trimmed.charAt(0).toLocaleUpperCase();
}

export function playerColorIndex(index: PlayerIndex): 1 | 2 {
  return index === 0 ? 1 : 2;
}
