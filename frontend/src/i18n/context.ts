import { createContext, useContext } from "react";
import { es } from "./es";
import type { Language } from "./language";
import type { Messages } from "./messages";

export interface I18nValue {
  readonly language: Language;
  readonly messages: Messages;
}

/** Without a provider the game view is Spanish, exactly as before. */
export const I18nContext = createContext<I18nValue>({
  language: "es",
  messages: es,
});

export function useMessages(): Messages {
  return useContext(I18nContext).messages;
}

export function useCurrentLanguage(): Language {
  return useContext(I18nContext).language;
}
