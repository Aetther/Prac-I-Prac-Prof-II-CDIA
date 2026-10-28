import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App routes", () => {
  it("APP-01 /admin renders Administración and the key gate", () => {
    window.history.pushState({}, "", "/admin");
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Administración" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Clave de administración")).toHaveAttribute(
      "type",
      "password",
    );
    expect(screen.getByRole("button", { name: "Ingresar" })).toBeDisabled();
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
  });

  it("APP-02 / still renders the game", () => {
    window.history.pushState({}, "", "/");
    render(<App />);

    expect(screen.getByRole("heading", { name: "TRIVIA" })).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Administración" }),
    ).not.toBeInTheDocument();
  });
});
