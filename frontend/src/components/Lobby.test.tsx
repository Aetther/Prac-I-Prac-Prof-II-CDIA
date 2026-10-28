import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Lobby } from "./Lobby";

describe("Lobby", () => {
  it("shows the mode selector with Por rondas selected and the default values", () => {
    render(<Lobby onStart={vi.fn()} />);

    const mode = screen.getByLabelText("Modo de juego") as HTMLSelectElement;
    expect(mode.value).toBe("rounds");
    expect(
      within(mode)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Por rondas", "Juntar las 6 categorías"]);
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
    expect(screen.getByRole("button", { name: "JUGAR" })).toBeDisabled();
  });

  it("selecting six categories hides Rondas, keeps Tiempo and restores the held value", async () => {
    const user = userEvent.setup();
    render(<Lobby onStart={vi.fn()} />);

    await user.selectOptions(
      screen.getByLabelText("Tiempo por pregunta"),
      "10",
    );
    await user.selectOptions(screen.getByLabelText("Rondas"), "3");
    await user.type(screen.getByLabelText("Jugador 1"), "Ana");
    await user.type(screen.getByLabelText("Jugador 2"), "Beto");

    await user.selectOptions(
      screen.getByLabelText("Modo de juego"),
      "six-categories",
    );

    expect(screen.queryByLabelText("Rondas")).toBeNull();
    expect(
      (screen.getByLabelText("Tiempo por pregunta") as HTMLSelectElement).value,
    ).toBe("10");
    expect(
      (screen.getByLabelText("Modo de juego") as HTMLSelectElement).value,
    ).toBe("six-categories");

    await user.selectOptions(screen.getByLabelText("Modo de juego"), "rounds");

    expect((screen.getByLabelText("Rondas") as HTMLSelectElement).value).toBe(
      "3",
    );
    expect(
      (screen.getByLabelText("Tiempo por pregunta") as HTMLSelectElement).value,
    ).toBe("10");
  });

  it("keeps JUGAR disabled while either name is blank", async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(<Lobby onStart={onStart} />);

    const start = screen.getByRole("button", { name: "JUGAR" });
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

  it("enables JUGAR when both names contain text", async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(<Lobby onStart={onStart} />);

    await user.type(screen.getByLabelText("Jugador 1"), "Ana");
    await user.type(screen.getByLabelText("Jugador 2"), "Beto");

    const start = screen.getByRole("button", { name: "JUGAR" });
    expect(start).toBeEnabled();
    await user.click(start);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("emits the raw lobby input on JUGAR with the rounds mode", async () => {
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
    await user.click(screen.getByRole("button", { name: "JUGAR" }));

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledWith({
      playerNames: [" Ana ", "Beto"],
      lang: "en",
      secondsPerQuestion: 30,
      mode: "rounds",
      rounds: 3,
    });
  });

  it("emits the six-categories payload without rounds", async () => {
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
    await user.selectOptions(
      screen.getByLabelText("Modo de juego"),
      "six-categories",
    );
    await user.click(screen.getByRole("button", { name: "JUGAR" }));

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledWith({
      playerNames: [" Ana ", "Beto"],
      lang: "en",
      secondsPerQuestion: 30,
      mode: "six-categories",
    });
    const payload = onStart.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("rounds");
    expect("rounds" in payload).toBe(false);
  });

  it("associates the six labels with their controls in rounds mode", () => {
    render(<Lobby onStart={vi.fn()} />);

    expect(screen.getByRole("textbox", { name: "Jugador 1" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Jugador 2" })).toBeVisible();
    expect(
      screen.getByRole("combobox", { name: "Idioma de las preguntas" }),
    ).toBeVisible();
    expect(
      screen.getByRole("combobox", { name: "Tiempo por pregunta" }),
    ).toBeVisible();
    expect(
      screen.getByRole("combobox", { name: "Modo de juego" }),
    ).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Rondas" })).toBeVisible();
    expect(screen.getByRole("button", { name: "JUGAR" })).toBeVisible();
  });

  it("labels only the controls it shows in six mode and gives each the touch target", async () => {
    const user = userEvent.setup();
    render(<Lobby onStart={vi.fn()} />);

    await user.selectOptions(
      screen.getByLabelText("Modo de juego"),
      "six-categories",
    );

    expect(
      screen.getByRole("combobox", { name: "Modo de juego" }),
    ).toBeVisible();
    expect(screen.queryByLabelText("Rondas")).toBeNull();
    expect(screen.getByRole("textbox", { name: "Jugador 1" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Jugador 2" })).toBeVisible();
    expect(
      screen.getByRole("combobox", { name: "Idioma de las preguntas" }),
    ).toBeVisible();
    expect(
      screen.getByRole("combobox", { name: "Tiempo por pregunta" }),
    ).toBeVisible();

    const controls = [
      ...screen.getAllByRole("button"),
      ...screen.getAllByRole("textbox"),
      ...screen.getAllByRole("combobox"),
    ];
    expect(controls).toHaveLength(6);
    for (const control of controls) {
      expect(control).toHaveClass("touch-target");
    }
  });

  it("gives every interactive control the touch-target class", () => {
    render(<Lobby onStart={vi.fn()} />);

    const controls = [
      ...screen.getAllByRole("button"),
      ...screen.getAllByRole("textbox"),
      ...screen.getAllByRole("combobox"),
    ];

    expect(controls.length).toBeGreaterThanOrEqual(6);
    expect(controls).toHaveLength(7);
    for (const control of controls) {
      expect(control).toHaveClass("touch-target");
    }
  });

  it("offers exactly the declared language, time, mode and rounds options", () => {
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
    expect(optionsFor("Modo de juego")).toEqual([
      "Por rondas",
      "Juntar las 6 categorías",
    ]);
    expect(optionsFor("Rondas")).toEqual(["3 rondas", "5 rondas", "10 rondas"]);
  });

  it("LOB-01 the sign is an h1 named TRIVIA with two aria-hidden sparkles, the tagline and a decorative mini wheel", () => {
    const { container } = render(<Lobby onStart={vi.fn()} />);

    const heading = screen.getByRole("heading", { name: "TRIVIA" });
    expect(heading.tagName).toBe("H1");
    expect(heading).toHaveClass("lobby-sign");
    const sparkles = heading.querySelectorAll(".lobby-sign-sparkle");
    expect(sparkles).toHaveLength(2);
    for (const sparkle of sparkles) {
      expect(sparkle).toHaveAttribute("aria-hidden", "true");
      expect(sparkle.textContent).toBe("✨");
    }
    expect(screen.getByText("Poné a prueba tu conocimiento")).toBeVisible();

    const miniWheel = container.querySelector(".lobby-mini-wheel");
    expect(miniWheel).not.toBeNull();
    expect(miniWheel).toHaveAttribute("aria-hidden", "true");
    expect(miniWheel!.tagName).not.toBe("CANVAS");
    expect(miniWheel!.textContent).toBe("");
    expect(container.querySelector("canvas")).toBeNull();
  });

  it('LOB-02 "JUGAR" is the only start action and it keeps the disabled-until-two-names rule', async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(<Lobby onStart={onStart} />);

    const start = screen.getByRole("button", { name: "JUGAR" });
    expect(start).toBeDisabled();
    expect(start).toHaveClass("button-primary", "touch-target");
    expect(
      screen.queryByRole("button", { name: "Comenzar" }),
    ).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Jugador 1"), "Ana");
    await user.type(screen.getByLabelText("Jugador 2"), "   ");
    expect(start).toBeDisabled();

    await user.clear(screen.getByLabelText("Jugador 2"));
    await user.type(screen.getByLabelText("Jugador 2"), "Beto");
    expect(start).toBeEnabled();
    await user.click(start);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('LOB-03 no "Comenzar" text or accessible name survives in the Lobby', () => {
    const { container } = render(<Lobby onStart={vi.fn()} />);

    expect(container.textContent).not.toContain("Comenzar");
    expect(
      screen.queryByRole("button", { name: /Comenzar/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "JUGAR" })).toBeVisible();
  });
});
