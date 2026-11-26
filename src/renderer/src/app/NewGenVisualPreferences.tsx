import { createContext, useContext, useLayoutEffect, useMemo, useState, type PropsWithChildren, type ReactElement } from "react";

type Language = "en" | "hu";

interface VisualPreferences {
  language: Language;
  motion: boolean;
  setLanguage: (language: Language) => void;
  setMotion: (motion: boolean) => void;
  text: (en: string, hu: string) => string;
}

const Context = createContext<VisualPreferences>({
  language: "en",
  motion: true,
  setLanguage: () => undefined,
  setMotion: () => undefined,
  text: (en) => en,
});

function readPreference(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writePreference(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // The setting remains usable for this session if storage is unavailable.
  }
}

export function useNewGenVisualPreferences(): VisualPreferences {
  return useContext(Context);
}

export function NewGenVisualPreferences({ children }: PropsWithChildren): ReactElement {
  const [language, setLanguage] = useState<Language>(() =>
    readPreference("newgen.language") === "hu" ? "hu" : "en",
  );
  const [motion, setMotion] = useState(() => readPreference("newgen.motion") !== "off");

  useLayoutEffect(() => {
    const root = document.documentElement;
    const previousLanguage = root.lang;
    root.lang = language;
    root.dataset.newgenMotion = motion ? "on" : "off";
    writePreference("newgen.language", language);
    writePreference("newgen.motion", motion ? "on" : "off");
    return () => {
      root.lang = previousLanguage;
      delete root.dataset.newgenMotion;
    };
  }, [language, motion]);

  const value = useMemo<VisualPreferences>(
    () => ({ language, motion, setLanguage, setMotion, text: (en, hu) => (language === "hu" ? hu : en) }),
    [language, motion],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}
