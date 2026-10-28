import { describe, expect, it } from "vitest";
import { playerColorIndex, playerInitial } from "./playerIdentity";

describe("player identity", () => {
  it("PLAYER-01 playerInitial uppercases the first character of the trimmed name and returns an empty string for blank input", () => {
    expect(playerInitial("Ana")).toBe("A");
    expect(playerInitial("beto")).toBe("B");
    expect(playerInitial(" Ana ")).toBe("A");
    expect(playerInitial("Ana María")).toBe("A");
    expect(playerInitial("ángela")).toBe("Á");
    expect(playerInitial("")).toBe("");
    expect(playerInitial("   ")).toBe("");
    expect(playerInitial("ana")).toBe(playerInitial("Ana"));
    expect(playerInitial("Beto")).toBe("B");
  });

  it("playerColorIndex maps player 0 to colour 1 and player 1 to colour 2", () => {
    expect(playerColorIndex(0)).toBe(1);
    expect(playerColorIndex(1)).toBe(2);
  });
});
