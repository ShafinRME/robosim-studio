"use client";

import { clampStep, formatSI, parseSI } from "@robosim/core";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useId, useState, type KeyboardEvent } from "react";
import { fieldClass } from "@robosim/ui/components/input";
import { cn } from "@robosim/ui/lib/utils";

export interface NumberFieldProps {
  /** Current value (controlled). */
  value: number;
  onChange: (value: number) => void;
  /** Unit shown after the value, e.g. "Ω", "V", "Hz". */
  unit?: string;
  min?: number;
  max?: number;
  /** Arrow keys and the stepper change the value by `step` (×10 with Shift). */
  step?: number;
  /** Show values with SI prefixes (4.7 k) and accept them when typing (4.7k). Default true. */
  engineering?: boolean;
  /** Significant digits when formatting. */
  digits?: number;
  label?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Engineering number input: type "4.7k", "100n" or "2.2e-6"; Enter or leaving the field commits,
 * Escape reverts, ↑/↓ step (Shift ×10). Invalid text never reaches the simulation — the field turns
 * red and keeps the last valid value.
 */
export function NumberField({
  value,
  onChange,
  unit = "",
  min,
  max,
  step = 1,
  engineering = true,
  digits = 4,
  label,
  id,
  disabled,
  className,
}: NumberFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const format = (v: number) => (engineering ? formatSI(v, "", digits) : String(v));

  // `draft` is only set while the user is typing; otherwise the field shows the formatted value.
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const text = draft ?? format(value);

  function commit(raw: string) {
    const parsed = engineering ? parseSI(raw, unit || undefined) : Number(raw);
    if (parsed === null || !Number.isFinite(parsed) || raw.trim() === "") {
      setInvalid(true);
      return;
    }
    const next = clampStep(parsed, { min, max });
    setInvalid(false);
    setDraft(null);
    if (next !== value) onChange(next);
  }

  function nudge(direction: 1 | -1, big: boolean) {
    const next = clampStep(value + direction * step * (big ? 10 : 1), { min, max });
    setInvalid(false);
    setDraft(null);
    if (next !== value) onChange(next);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      commit(text);
    } else if (event.key === "Escape") {
      setDraft(null);
      setInvalid(false);
    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      nudge(event.key === "ArrowUp" ? 1 : -1, event.shiftKey);
    }
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label ? (
        <label htmlFor={inputId} className="text-xs text-muted-foreground">
          {label}
        </label>
      ) : null}
      <div className="relative flex items-center">
        <input
          id={inputId}
          type="text"
          inputMode="decimal"
          role="spinbutton"
          aria-valuenow={value}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuetext={formatSI(value, unit, digits)}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          spellCheck={false}
          autoComplete="off"
          value={text}
          onChange={(e) => {
            setDraft(e.target.value);
            setInvalid(false);
          }}
          onBlur={() => {
            if (draft !== null) commit(draft);
          }}
          onKeyDown={onKeyDown}
          className={cn(fieldClass, "tabular pr-14 font-mono text-[0.8125rem]")}
        />
        <span className="pointer-events-none absolute right-8 font-mono text-xs text-faint-foreground">
          {unit}
        </span>
        <div className="absolute inset-y-px right-px flex w-6 flex-col overflow-hidden rounded-r-[calc(var(--radius)-1px)] border-l border-input">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Increase"
            disabled={disabled}
            onClick={(e) => nudge(1, e.shiftKey)}
            className="flex flex-1 items-center justify-center text-faint-foreground hover:bg-surface-3 hover:text-brand"
          >
            <ChevronUp className="size-3" />
          </button>
          <button
            type="button"
            tabIndex={-1}
            aria-label="Decrease"
            disabled={disabled}
            onClick={(e) => nudge(-1, e.shiftKey)}
            className="flex flex-1 items-center justify-center border-t border-input text-faint-foreground hover:bg-surface-3 hover:text-brand"
          >
            <ChevronDown className="size-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
