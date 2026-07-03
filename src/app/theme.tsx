import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ThemeMode = "system" | "light" | "dark";
export type ResolvedThemeMode = "light" | "dark";

const THEME_STORAGE_KEY = "ordersounds-theme-mode";
const THEME_QUERY = "(prefers-color-scheme: dark)";

type ThemeContextValue = {
  mode: ThemeMode;
  resolvedMode: ResolvedThemeMode;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const fallbackThemeContext: ThemeContextValue = {
  mode: "system",
  resolvedMode: "light",
  setMode: () => undefined,
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => readStoredThemeMode());
  const [systemMode, setSystemMode] = useState<ResolvedThemeMode>(() => readSystemThemeMode());

  const resolvedMode = mode === "system" ? systemMode : mode;

  useEffect(() => {
    const media = window.matchMedia?.(THEME_QUERY);
    if (!media) return undefined;

    const updateSystemMode = (event: MediaQueryListEvent) => setSystemMode(event.matches ? "dark" : "light");
    media.addEventListener("change", updateSystemMode);

    return () => media.removeEventListener("change", updateSystemMode);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", resolvedMode === "dark");
    root.classList.toggle("app-theme-dark", resolvedMode === "dark");
    root.classList.toggle("app-theme-light", resolvedMode === "light");
    root.style.colorScheme = resolvedMode;
  }, [resolvedMode]);

  const setMode = (nextMode: ThemeMode) => {
    setModeState(nextMode);
    if (nextMode === "system") {
      localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      localStorage.setItem(THEME_STORAGE_KEY, nextMode);
    }
  };

  const value = useMemo(() => ({ mode, resolvedMode, setMode }), [mode, resolvedMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  return value ?? fallbackThemeContext;
}

function readStoredThemeMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  } catch {
    return "system";
  }
}

function readSystemThemeMode(): ResolvedThemeMode {
  return window.matchMedia?.(THEME_QUERY).matches ? "dark" : "light";
}
