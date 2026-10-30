import { useMemo } from "react";
import type { ReactNode } from "react";
import { I18nContext } from "./context";
import { messagesFor } from "./language";
import type { Language } from "./language";

interface I18nProviderProps {
  language: Language;
  children: ReactNode;
}

export function I18nProvider({ language, children }: I18nProviderProps) {
  const value = useMemo(
    () => ({ language, messages: messagesFor(language) }),
    [language],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
