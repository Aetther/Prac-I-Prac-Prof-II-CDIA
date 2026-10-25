import { describe, expect, it } from "vitest";
import type { GamePhase } from "./types";

describe("game types", () => {
  it("phases exist", () => {
    const p: GamePhase = "GameOver";
    expect(p).toBe("GameOver");
  });
});
