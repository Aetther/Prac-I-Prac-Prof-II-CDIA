import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App routes", () => {
  it("renders Trivia IA at / and Admin at /admin", () => {
    window.history.pushState({}, "", "/");
    const { unmount } = render(<App />);
    expect(screen.getByRole("heading", { name: "Trivia IA" })).toBeVisible();
    unmount();

    window.history.pushState({}, "", "/admin");
    render(<App />);
    expect(screen.getByText("Admin")).toBeVisible();
  });
});
