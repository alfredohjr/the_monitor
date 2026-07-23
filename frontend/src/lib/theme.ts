// Tema claro/escuro (#225). O app nasceu todo escuro; aqui está a BASE que
// respeita o tema do sistema operacional (prefers-color-scheme) e cai no ESCURO
// quando indefinido, com override manual persistido em localStorage.
// A conversão visual das telas é incremental (ciclos seguintes).

export type Theme = "light" | "dark";
const STORAGE_KEY = "theme";

/** Tema do SO. `prefers-color-scheme: light` → claro; senão (dark/indefinido) → escuro. */
export function getSystemTheme(): Theme {
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return "dark";
}

/** Preferência salva pelo usuário, ou null se nunca escolheu. */
export function getStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" ? v : null;
}

/** Tema inicial: escolha salva vence; senão, o do SO (default escuro). */
export function getInitialTheme(): Theme {
  return getStoredTheme() ?? getSystemTheme();
}

/** Aplica o tema no <html> via data-theme (o CSS/Tailwind `dark:` reage a isso). */
export function applyTheme(theme: Theme): void {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", theme);
  }
}

/** Define e persiste o tema. */
export function setTheme(theme: Theme): void {
  if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
}

/** Alterna entre claro/escuro a partir do que está aplicado no <html>. */
export function toggleTheme(): Theme {
  const atual = typeof document !== "undefined"
    ? document.documentElement.getAttribute("data-theme")
    : null;
  const next: Theme = atual === "light" ? "dark" : "light";
  setTheme(next);
  return next;
}
