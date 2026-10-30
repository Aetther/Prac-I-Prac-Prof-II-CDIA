import { useCallback, useState } from "react";
import { browserLanguageStorage, loadLanguage, saveLanguage } from "./language";
import type { Language, LanguageStorage } from "./language";

export interface UseLanguageOptions {
  readonly storage?: LanguageStorage | null;
}

export function useLanguage(options: UseLanguageOptions = {}): {
  readonly language: Language;
  setLanguage(language: Language): void;
} {
  const [storage] = useState(() =>
    options.storage === undefined ? browserLanguageStorage() : options.storage,
  );
  const [language, setState] = useState(() => loadLanguage(storage));
  const setLanguage = useCallback(
    (next: Language) => {
      setState(next);
      saveLanguage(storage, next);
    },
    [storage],
  );
  return { language, setLanguage };
}
