import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { CategoryName } from "../game/types";
import { CATEGORY_NAMES } from "../game/category";
import { SIX_WHEEL_CATEGORIES } from "../test/wheelFixtures";
import { CATEGORY_COLOR_TOKENS, CategoryChips } from "./CategoryChips";

const allNames: readonly CategoryName[] = CATEGORY_NAMES;

describe("CategoryChips", () => {
  it("CHIP-01 renders the chips in acquisition order with the API label and its token colour", () => {
    render(
      <CategoryChips
        playerName="Ana"
        categories={SIX_WHEEL_CATEGORIES}
        owned={["geografia", "ciencia"]}
      />,
    );

    const list = screen.getByRole("list", { name: "Categorías de Ana" });
    const chips = within(list).getAllByRole("listitem");
    expect(chips).toHaveLength(2);
    expect(chips.map((chip) => chip.textContent)).toEqual([
      "Geografía",
      "Ciencia",
    ]);
    expect(chips[0].style.backgroundColor).toBe(
      "var(--color-category-geografia)",
    );
    expect(chips[1].style.backgroundColor).toBe(
      "var(--color-category-ciencia)",
    );
    for (const chip of chips) {
      expect(chip).toHaveClass("category-chip");
    }
  });

  it("CHIP-02 shows Sin categorías and no chip for an empty list", () => {
    const { rerender } = render(
      <CategoryChips
        playerName="Beto"
        categories={SIX_WHEEL_CATEGORIES}
        owned={[]}
      />,
    );

    expect(screen.getByText("Sin categorías")).toBeVisible();
    expect(document.querySelectorAll(".category-chip")).toHaveLength(0);

    rerender(
      <CategoryChips
        playerName="Beto"
        categories={SIX_WHEEL_CATEGORIES}
        owned={["arte"]}
      />,
    );

    expect(screen.queryByText("Sin categorías")).toBeNull();
    expect(document.querySelectorAll(".category-chip")).toHaveLength(1);
    expect(screen.getByText("Arte")).toBeVisible();
  });

  it("CHIP-03 falls back to the category name when the API label is missing", () => {
    const withoutArte = SIX_WHEEL_CATEGORIES.filter(
      (category) => category.name !== "arte",
    );
    const { rerender } = render(
      <CategoryChips
        playerName="Ana"
        categories={withoutArte}
        owned={["arte"]}
      />,
    );

    expect(screen.getByText("arte")).toBeVisible();
    expect(screen.queryByText("Arte")).toBeNull();

    rerender(
      <CategoryChips
        playerName="Ana"
        categories={SIX_WHEEL_CATEGORIES}
        owned={["arte"]}
      />,
    );

    expect(screen.getByText("Arte")).toBeVisible();
  });

  it("CHIP-04 every chip has a non-empty text label and the list has its accessible name", () => {
    render(
      <CategoryChips
        playerName="Ana"
        categories={SIX_WHEEL_CATEGORIES}
        owned={allNames}
      />,
    );

    const list = screen.getByRole("list", { name: "Categorías de Ana" });
    const chips = within(list).getAllByRole("listitem");
    expect(chips).toHaveLength(6);
    for (const [index, chip] of chips.entries()) {
      expect(chip.textContent?.trim()).not.toBe("");
      expect(chip.textContent).toBe(SIX_WHEEL_CATEGORIES[index].label);
      expect(chip).not.toHaveAttribute("aria-hidden", "true");
    }
  });

  it("CHIP-05 maps each category to its own token and uses no hex literal", () => {
    expect(CATEGORY_COLOR_TOKENS).toEqual({
      geografia: "var(--color-category-geografia)",
      historia: "var(--color-category-historia)",
      ciencia: "var(--color-category-ciencia)",
      arte: "var(--color-category-arte)",
      entretenimiento: "var(--color-category-entretenimiento)",
      deportes: "var(--color-category-deportes)",
    });

    render(
      <CategoryChips
        playerName="Ana"
        categories={SIX_WHEEL_CATEGORIES}
        owned={allNames}
      />,
    );

    for (const chip of document.querySelectorAll(".category-chip")) {
      expect(chip.getAttribute("style")).not.toContain("#");
    }
  });
});
