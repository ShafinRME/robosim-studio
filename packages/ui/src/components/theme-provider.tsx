"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

export type ThemeChoice = "system" | "light" | "dark";

/**
 * Theme state for the whole studio. Dark is the default (ADR 002); "system" follows the OS.
 * The choice is stored in localStorage under `robosim-theme` and applied as a class on <html>
 * before first paint, so there is no flash of the wrong theme.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      themes={["light", "dark"]}
      storageKey="robosim-theme"
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
