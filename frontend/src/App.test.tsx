import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  it("renders routes for /", () => {
    window.history.pushState({}, "", "/");
    render(<App />);
    expect(screen.getByText("Home")).toBeTruthy();
  });

  it("renders routes for /admin", () => {
    window.history.pushState({}, "", "/admin");
    render(<App />);
    expect(screen.getByText("Admin")).toBeTruthy();
  });
});
