import type { ComponentProps } from "react";
import { cn } from "@robosim/ui/lib/utils";

/** Inset field: darker than its panel, teal focus ring, red when `aria-invalid`. */
const fieldClass = cn(
  "h-(--control-h) w-full min-w-0 rounded-md border border-input bg-canvas px-2.5 text-sm text-foreground",
  "selection:bg-brand-soft placeholder:text-faint-foreground",
  "transition-[border-color,box-shadow] duration-(--duration-fast) outline-none",
  "hover:border-border-strong focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand-soft",
  "aria-invalid:border-danger aria-invalid:ring-danger/20",
  "disabled:cursor-not-allowed disabled:opacity-45",
  "file:mr-2 file:border-0 file:bg-transparent file:text-xs file:font-medium",
);

function Input({ className, type = "text", ...props }: ComponentProps<"input">) {
  return <input data-slot="input" type={type} className={cn(fieldClass, className)} {...props} />;
}

export { Input, fieldClass };
