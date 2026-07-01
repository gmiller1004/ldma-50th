"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import "./caretaker-theme.css";

const STORAGE_KEY = "caretaker-theme";

export type CaretakerTheme = "dark" | "light";

export function CaretakerThemeShell({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<CaretakerTheme>("dark");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate saved theme once on mount
      setTheme(stored);
    }
  }, []);

  function toggle() {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }

  return (
    <div
      data-caretaker-theme={theme}
      className="caretaker-themed mt-4 rounded-xl border border-[#d4af37]/15 px-4 sm:px-6 lg:px-8 xl:px-10 py-5 sm:py-6"
      style={{ backgroundColor: "var(--ct-page)", color: "var(--ct-text)", minHeight: "1px" }}
    >
      <div className="flex justify-end mb-4">
        <button
          type="button"
          onClick={toggle}
          className="ct-theme-toggle"
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
      </div>
      {children}
    </div>
  );
}
