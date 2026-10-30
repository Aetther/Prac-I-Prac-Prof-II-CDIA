import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_AUDIO_PREFERENCES } from "../audio";
import type { AudioPreferences } from "../audio";
import { AudioControls } from "./AudioControls";

function renderControls(
  preferences: AudioPreferences = DEFAULT_AUDIO_PREFERENCES,
) {
  const sound = {
    preferences,
    setMuted: vi.fn(),
    setVolume: vi.fn(),
    setEffects: vi.fn(),
    setMusic: vi.fn(),
  };
  render(<AudioControls sound={sound} />);
  return sound;
}

afterEach(() => {
  cleanup();
});

describe("AudioControls", () => {
  it("AUD-UI-01 renders the Sonido group with the four controls and the defaults", () => {
    renderControls();
    const group = screen.getByRole("region", { name: "Sonido" });
    expect(group).toHaveClass("audio-controls");
    expect(
      screen.getByRole("button", { name: "Activar sonido" }),
    ).toBeInTheDocument();
    const volume = screen.getByRole("slider", { name: "Volumen" });
    expect(volume).toHaveValue("60");
    expect(volume).toHaveAttribute("min", "0");
    expect(volume).toHaveAttribute("max", "100");
    expect(volume).toHaveAttribute("step", "5");
    expect(screen.getByRole("button", { name: "Efectos" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Música" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("AUD-UI-02 the master button names the action and never carries aria-pressed", async () => {
    const user = userEvent.setup();
    const sound = renderControls();
    const muted = screen.getByRole("button", { name: "Activar sonido" });
    expect(muted).not.toHaveAttribute("aria-pressed");
    expect(muted.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    await user.click(muted);
    expect(sound.setMuted).toHaveBeenCalledWith(false);
    cleanup();
    const unmuted = renderControls({
      ...DEFAULT_AUDIO_PREFERENCES,
      muted: false,
    });
    const button = screen.getByRole("button", { name: "Silenciar sonido" });
    expect(button).not.toHaveAttribute("aria-pressed");
    await user.click(button);
    expect(unmuted.setMuted).toHaveBeenCalledWith(true);
  });

  it("AUD-UI-03 the switches toggle their own preference and show its state", async () => {
    const user = userEvent.setup();
    const sound = renderControls({
      ...DEFAULT_AUDIO_PREFERENCES,
      music: false,
    });
    expect(screen.getByRole("button", { name: "Música" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await user.click(screen.getByRole("button", { name: "Música" }));
    expect(sound.setMusic).toHaveBeenCalledWith(true);
    await user.click(screen.getByRole("button", { name: "Efectos" }));
    expect(sound.setEffects).toHaveBeenCalledWith(false);
    expect(sound.setMuted).not.toHaveBeenCalled();
  });

  it("AUD-UI-04 moving the slider sends the new volume as a number", () => {
    const sound = renderControls();
    fireEvent.change(screen.getByRole("slider", { name: "Volumen" }), {
      target: { value: "30" },
    });
    expect(sound.setVolume).toHaveBeenCalledWith(30);
  });

  it("AUD-UI-05 every control carries the touch-target class", () => {
    renderControls();
    for (const control of [
      ...screen.getAllByRole("button"),
      screen.getByRole("slider", { name: "Volumen" }),
    ]) {
      expect(control).toHaveClass("touch-target");
    }
  });
});
