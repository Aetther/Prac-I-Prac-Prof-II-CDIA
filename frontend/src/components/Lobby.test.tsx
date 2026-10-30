import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "../i18n";
import { Lobby } from "./Lobby";

function group(name: string): HTMLElement {
  return screen.getByRole("group", { name });
}

function radioNames(name: string): string[] {
  return within(group(name))
    .getAllByRole("radio")
    .map((radio) => radio.getAttribute("aria-label") ?? "");
}

function checkedName(name: string): string | null {
  const checked = within(group(name))
    .getAllByRole("radio")
    .find((radio) => (radio as HTMLInputElement).checked);
  return checked?.getAttribute("aria-label") ?? null;
}

async function fillNames(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Jugador 1"), " Ana ");
  await user.type(screen.getByLabelText("Jugador 2"), "Beto");
}

describe("Lobby", () => {
  it("Defaults are shown", () => {
    render(<Lobby onStart={vi.fn()} />);
    expect(checkedName("Idioma")).toBe("Español");
    expect(checkedName("Dificultad")).toBe("Intermedia");
    expect(
      within(group("Dificultad")).getByRole("radio", { name: "Intermedia" }),
    ).toHaveAccessibleDescription("20 segundos");
    expect(checkedName("Modo de juego")).toBe("Por rondas");
    expect(checkedName("Rondas")).toBe("5 rondas");
    expect(screen.getByRole("button", { name: "JUGAR" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Comenzar" })).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("Difficulty maps to the seconds per question", async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(<Lobby onStart={onStart} />);
    expect(radioNames("Dificultad")).toEqual([
      "Fácil",
      "Intermedia",
      "Difícil",
    ]);
    await fillNames(user);
    for (const [name, seconds] of [
      ["Difícil", 10],
      ["Fácil", 30],
      ["Intermedia", 20],
    ] as const) {
      await user.click(screen.getByRole("radio", { name }));
      await user.click(screen.getByRole("button", { name: "JUGAR" }));
      expect(onStart).toHaveBeenLastCalledWith(
        expect.objectContaining({ secondsPerQuestion: seconds }),
      );
    }
  });

  it("Selecting six categories hides the rounds selector and keeps the time selector", async () => {
    const user = userEvent.setup();
    render(<Lobby onStart={vi.fn()} />);
    await user.click(
      screen.getByRole("radio", { name: "Juntar las 6 categorías" }),
    );
    expect(screen.queryByRole("group", { name: "Rondas" })).toBeNull();
    expect(checkedName("Dificultad")).toBe("Intermedia");
    expect(checkedName("Modo de juego")).toBe("Juntar las 6 categorías");
    expect(screen.getByRole("button", { name: "JUGAR" })).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: "Por rondas" }));
    expect(checkedName("Rondas")).toBe("5 rondas");
  });

  it("keeps JUGAR disabled while either name is blank", async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(<Lobby onStart={onStart} />);
    const start = screen.getByRole("button", { name: "JUGAR" });
    await user.type(screen.getByLabelText("Jugador 1"), "Ana");
    expect(start).toBeDisabled();
    await user.type(screen.getByLabelText("Jugador 2"), "   ");
    expect(start).toBeDisabled();
    await user.click(start);
    expect(onStart).not.toHaveBeenCalled();
  });

  it("enables JUGAR when both names contain text", async () => {
    const user = userEvent.setup();
    render(<Lobby onStart={vi.fn()} />);
    await user.type(screen.getByLabelText("Jugador 1"), "Ana");
    await user.type(screen.getByLabelText("Jugador 2"), "Beto");
    expect(screen.getByRole("button", { name: "JUGAR" })).toBeEnabled();
  });

  it("emits the raw lobby input on JUGAR with the rounds mode", async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    const onLanguageChange = vi.fn();
    render(<Lobby onStart={onStart} onLanguageChange={onLanguageChange} />);
    await fillNames(user);
    await user.click(screen.getByRole("radio", { name: "English" }));
    expect(onLanguageChange).toHaveBeenCalledWith("en");
    await user.click(screen.getByRole("radio", { name: "Fácil" }));
    await user.click(screen.getByRole("radio", { name: "3 rondas" }));
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
    await fillNames(user);
    await user.click(screen.getByRole("radio", { name: "English" }));
    await user.click(screen.getByRole("radio", { name: "Fácil" }));
    await user.click(
      screen.getByRole("radio", { name: "Juntar las 6 categorías" }),
    );
    await user.click(screen.getByRole("button", { name: "JUGAR" }));
    expect(onStart).toHaveBeenCalledWith({
      playerNames: [" Ana ", "Beto"],
      lang: "en",
      secondsPerQuestion: 30,
      mode: "six-categories",
    });
    expect(onStart.mock.calls[0][0]).not.toHaveProperty("rounds");
  });

  it("Labels are associated with their controls", () => {
    render(<Lobby onStart={vi.fn()} />);
    expect(screen.getByLabelText("Jugador 1")).toHaveRole("textbox");
    expect(screen.getByLabelText("Jugador 2")).toHaveRole("textbox");
    for (const name of ["Idioma", "Dificultad", "Modo de juego", "Rondas"]) {
      const radios = within(group(name)).getAllByRole("radio");
      expect(radios.length).toBeGreaterThanOrEqual(2);
      for (const radio of radios) expect(radio).toHaveAccessibleName();
      expect(
        radios.filter((radio) => (radio as HTMLInputElement).checked),
      ).toHaveLength(1);
    }
    expect(screen.getByRole("button", { name: "JUGAR" })).toBeInTheDocument();
  });

  it("All Lobby controls are touch targets", () => {
    render(<Lobby onStart={vi.fn()} />);
    const textboxes = screen.getAllByRole("textbox");
    const buttons = screen.getAllByRole("button");
    const radios = screen.getAllByRole("radio");
    expect(
      textboxes.length + buttons.length + radios.length,
    ).toBeGreaterThanOrEqual(13);
    for (const control of [...textboxes, ...buttons]) {
      expect(control).toHaveClass("touch-target");
    }
    for (const radio of radios) {
      expect(radio.closest("label")).toHaveClass("touch-target");
    }
  });

  it("The six-categories Lobby labels only the controls it shows", async () => {
    const user = userEvent.setup();
    render(<Lobby onStart={vi.fn()} />);
    await user.click(
      screen.getByRole("radio", { name: "Juntar las 6 categorías" }),
    );
    for (const name of ["Idioma", "Dificultad", "Modo de juego"]) {
      expect(group(name)).toBeInTheDocument();
    }
    expect(screen.queryByRole("group", { name: "Rondas" })).toBeNull();
    expect(screen.getByLabelText("Jugador 1")).toHaveRole("textbox");
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio.closest("label")).toHaveClass("touch-target");
    }
  });

  it("The language buttons show a flag and a name", () => {
    render(<Lobby onStart={vi.fn()} />);
    expect(radioNames("Idioma")).toEqual(["Español", "English"]);
    expect(checkedName("Idioma")).toBe("Español");
    for (const [name, flag] of [
      ["Español", "es"],
      ["English", "en"],
    ] as const) {
      const label = screen.getByRole("radio", { name }).closest("label")!;
      const svg = label.querySelector("svg");
      expect(svg).toHaveAttribute("aria-hidden", "true");
      expect(svg).toHaveAttribute("data-flag", flag);
      expect(label).toHaveTextContent(name);
    }
    expect(document.body.textContent).not.toMatch(/🇪🇸|🇺🇸/u);
  });

  it("The choices render as buttons with their extra content", () => {
    render(<Lobby onStart={vi.fn()} />);
    for (const [name, seconds] of [
      ["Fácil", "30 segundos"],
      ["Intermedia", "20 segundos"],
      ["Difícil", "10 segundos"],
    ] as const) {
      expect(screen.getByRole("radio", { name })).toHaveAccessibleDescription(
        seconds,
      );
    }
    const rounds = group("Rondas");
    expect(within(rounds).getByText("Rondas:")).toBeInTheDocument();
    expect(
      [...rounds.querySelectorAll(".round-token")].map(
        (token) => token.textContent,
      ),
    ).toEqual(["3", "5", "10"]);
    expect(
      screen.getByRole("radio", { name: "Por rondas" }),
    ).toHaveAccessibleDescription("Gana quien sume más puntos");
    expect(
      screen.getByRole("radio", { name: "Juntar las 6 categorías" }),
    ).toHaveAccessibleDescription("Gana el primero en juntar las 6");
    const dots = document.querySelectorAll<HTMLElement>(".mode-dot");
    expect(dots).toHaveLength(6);
    for (const dot of dots) {
      expect(dot.style.backgroundColor).toMatch(
        /^var\(--color-category-[a-z]+\)$/,
      );
    }
    expect(document.querySelector(".mode-dots")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("The keyboard moves within a group", async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(<Lobby onStart={onStart} />);
    await fillNames(user);
    const medium = screen.getByRole("radio", { name: "Intermedia" });
    medium.focus();
    await user.keyboard("{ArrowRight}");
    const hard = screen.getByRole("radio", { name: "Difícil" });
    expect(hard).toBeChecked();
    expect(hard).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "JUGAR" }));
    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({ secondsPerQuestion: 10 }),
    );
  });

  it("LOB-02 the checked option carries choice-checked and the others do not", async () => {
    const user = userEvent.setup();
    render(<Lobby onStart={vi.fn()} />);
    await user.click(screen.getByRole("radio", { name: "10 rondas" }));
    const checked = document.querySelectorAll(
      ".choice-group-rounds .choice-checked",
    );
    expect(checked).toHaveLength(1);
    expect(checked[0]).toHaveAttribute("data-value", "10");
  });

  it("LOB-03 inside an English provider the Lobby copy is English", () => {
    render(
      <I18nProvider language="en">
        <Lobby onStart={vi.fn()} language="en" />
      </I18nProvider>,
    );
    expect(screen.getByLabelText("Player 1")).toHaveRole("textbox");
    expect(screen.getByRole("button", { name: "PLAY" })).toBeDisabled();
    for (const name of ["Language", "Difficulty", "Game mode", "Rounds"]) {
      expect(group(name)).toBeInTheDocument();
    }
    expect(screen.getByRole("radio", { name: "English" })).toBeChecked();
    expect(
      screen.getByRole("radio", { name: "Medium" }),
    ).toHaveAccessibleDescription("20 seconds");
    expect(screen.getByRole("radio", { name: "3 rounds" })).not.toBeChecked();
    expect(
      screen.getByText("Put your knowledge to the test"),
    ).toBeInTheDocument();
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
