"use client";

import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useRef, useSyncExternalStore, type KeyboardEvent } from "react";
import { cn } from "@robosim/ui/lib/utils";
import type { ThemeChoice } from "@robosim/ui/components/theme-provider";

const OPTIONS: { value: ThemeChoice; label: string; icon: LucideIcon }[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

const noopSubscribe = () => () => {};

function isThemeChoice(value: string | undefined): value is ThemeChoice {
  return value === "system" || value === "light" || value === "dark";
}

/** Segmented System / Light / Dark switch with a sliding "signal" indicator. */
export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  // The stored theme is only known in the browser; the server render shows the default.
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const current: ThemeChoice = mounted && isThemeChoice(theme) ? theme : "dark";
  const index = OPTIONS.findIndex((o) => o.value === current);

  function select(i: number) {
    const option = OPTIONS[(i + OPTIONS.length) % OPTIONS.length];
    if (!option) return;
    setTheme(option.value);
    buttons.current[OPTIONS.indexOf(option)]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      select(index + 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      select(index - 1);
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      onKeyDown={onKeyDown}
      className={cn(
        "relative inline-grid h-(--control-h) grid-cols-3 items-center rounded-md border bg-surface-1 p-0.5",
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute inset-y-0.5 left-0.5 w-[calc((100%-0.25rem)/3)] rounded-[calc(var(--radius)-2px)] bg-brand-soft shadow-glow transition-transform duration-(--duration) ease-(--ease-out)"
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {OPTIONS.map((option, i) => {
        const Icon = option.icon;
        const checked = i === index;
        return (
          <button
            key={option.value}
            ref={(el) => {
              buttons.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={option.label}
            title={option.label}
            tabIndex={checked ? 0 : -1}
            onClick={() => setTheme(option.value)}
            className={cn(
              "relative z-10 flex h-full items-center justify-center gap-1.5 px-2.5 font-mono text-2xs tracking-wider uppercase transition-colors duration-(--duration-fast)",
              "rounded-[calc(var(--radius)-2px)] focus-visible:outline-2 focus-visible:outline-offset-1",
              checked ? "text-brand" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            <span className="hidden sm:inline">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
