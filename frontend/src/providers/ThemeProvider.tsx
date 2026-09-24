import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "theme";

/** Tema fixo claro para apresentação — dark mode desativado na UI. */
function forceLightTheme(): void {
  document.documentElement.classList.remove("dark");
  document.documentElement.style.colorScheme = "light";
  try {
    localStorage.setItem(STORAGE_KEY, "light");
  } catch {
    /* storage indisponível */
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    forceLightTheme();
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: "light",
      setTheme: () => undefined,
      toggleTheme: () => undefined,
    }),
    [],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme deve ser usado dentro de ThemeProvider");
  }
  return context;
}
