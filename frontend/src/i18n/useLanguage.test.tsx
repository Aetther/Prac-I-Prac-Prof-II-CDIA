import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  act,
  cleanup,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { useCurrentLanguage, useMessages } from "./context";
import { I18nProvider } from "./I18nProvider";
import { LANGUAGE_KEY } from "./language";
import type { Language, LanguageStorage } from "./language";
import { useLanguage } from "./useLanguage";

function Probe() {
  const messages = useMessages();
  const language = useCurrentLanguage();
  return <p data-language={language}>{messages.play}</p>;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe("useLanguage and the provider", () => {
  it("I18N-UI-01 without a provider the copy is Spanish", () => {
    render(<Probe />);
    expect(screen.getByText("JUGAR")).toHaveAttribute("data-language", "es");
  });

  it("I18N-UI-02 the provider switches the copy", () => {
    const view = render(
      <I18nProvider language="en">
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByText("PLAY")).toHaveAttribute("data-language", "en");
    view.rerender(
      <I18nProvider language={"es" as Language}>
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByText("JUGAR")).toBeInTheDocument();
  });

  it("English is remembered after a reload", () => {
    const first = renderHook(() => useLanguage());
    expect(first.result.current.language).toBe("es");
    act(() => first.result.current.setLanguage("en"));
    expect(first.result.current.language).toBe("en");
    expect(localStorage.getItem(LANGUAGE_KEY)).toBe("en");
    first.unmount();
    expect(renderHook(() => useLanguage()).result.current.language).toBe("en");
  });

  it("I18N-UI-03 a failing injected store still switches for the session", () => {
    const throwing: LanguageStorage = {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
    };
    const { result } = renderHook(() => useLanguage({ storage: throwing }));
    expect(result.current.language).toBe("es");
    act(() => result.current.setLanguage("en"));
    expect(result.current.language).toBe("en");
  });
});
