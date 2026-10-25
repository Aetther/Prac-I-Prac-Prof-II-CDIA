import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Lobby } from "./Lobby";

describe("Lobby", () => {
  it("shows the default language, time and rounds with the mode line", () => {
    render(<Lobby onStart={vi.fn()} />);

    expect(
      (screen.getByLabelText("Idioma de las preguntas") as HTMLSelectElement)
        .value,
    ).toBe("es");
    expect(
      (screen.getByLabelText("Tiempo por pregunta") as HTMLSelectElement).value,
    ).toBe("20");
    expect((screen.getByLabelText("Rondas") as HTMLSelectElement).value).toBe(
      "5",
    );
    expect(screen.getByText("Modo de juego: Por rondas")).toBeVisible();
    expect(screen.getByRole("button", { name: "Comenzar" })).toBeDisabled();
  });

  it("keeps Comenzar disabled while either name is blank", async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(<Lobby onStart={onStart} />);

    const start = screen.getByRole("button", { name: "Comenzar" });
    await user.click(start);
    expect(start).toBeDisabled();
    expect(onStart).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Jugador 1"), "Ana");
    expect(start).toBeDisabled();
    await user.click(start);
    expect(onStart).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Jugador 2"), "   ");
    expect(start).toBeDisabled();
    await user.click(start);
    expect(onStart).not.toHaveBeenCalled();
  });

  it("enables Comenzar when both names contain text", async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(<Lobby onStart={onStart} />);

    await user.type(screen.getByLabelText("Jugador 1"), "Ana");
    await user.type(screen.getByLabelText("Jugador 2"), "Beto");

    const start = screen.getByRole("button", { name: "Comenzar" });
    expect(start).toBeEnabled();
    await user.click(start);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("emits the raw lobby input on Comenzar", async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(<Lobby onStart={onStart} />);

    await user.type(screen.getByLabelText("Jugador 1"), " Ana ");
    await user.type(screen.getByLabelText("Jugador 2"), "Beto");
    await user.selectOptions(
      screen.getByLabelText("Idioma de las preguntas"),
      "en",
    );
    await user.selectOptions(
      screen.getByLabelText("Tiempo por pregunta"),
      "30",
    );
    await user.selectOptions(screen.getByLabelText("Rondas"), "3");
    await user.click(screen.getByRole("button", { name: "Comenzar" }));

    expect(onStart).toHaveBeenCalledWith({
      playerNames: [" Ana ", "Beto"],
      lang: "en",
      secondsPerQuestion: 30,
      rounds: 3,
    });
  });

  it("associates the five labels with their controls", () => {
    render(<Lobby onStart={vi.fn()} />);

    expect(screen.getByRole("textbox", { name: "Jugador 1" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Jugador 2" })).toBeVisible();
    expect(
      screen.getByRole("combobox", { name: "Idioma de las preguntas" }),
    ).toBeVisible();
    expect(
      screen.getByRole("combobox", { name: "Tiempo por pregunta" }),
    ).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Rondas" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Comenzar" })).toBeVisible();
  });

  it("gives every interactive control the touch-target class", () => {
    render(<Lobby onStart={vi.fn()} />);

    const controls = [
      ...screen.getAllByRole("button"),
      ...screen.getAllByRole("textbox"),
      ...screen.getAllByRole("combobox"),
    ];

    expect(controls.length).toBeGreaterThanOrEqual(6);
    for (const control of controls) {
      expect(control).toHaveClass("touch-target");
    }
  });

  it("offers exactly the declared language, time and rounds options", () => {
    render(<Lobby onStart={vi.fn()} />);

    const optionsFor = (label: string) =>
      within(screen.getByLabelText(label))
        .getAllByRole("option")
        .map((option) => option.textContent);

    expect(optionsFor("Idioma de las preguntas")).toEqual([
      "Español",
      "English",
    ]);
    expect(optionsFor("Tiempo por pregunta")).toEqual([
      "10 segundos",
      "20 segundos",
      "30 segundos",
    ]);
    expect(optionsFor("Rondas")).toEqual(["3 rondas", "5 rondas", "10 rondas"]);
  });
});
