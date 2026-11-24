"use client";

import { Switch as SwitchPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@robosim/ui/lib/utils";

/** Compact toggle. When on, the track lights up in Signal teal like a live channel. */
function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-4 w-7 shrink-0 items-center rounded-full border border-border-strong bg-surface-3 p-px",
        "transition-[background-color,border-color,box-shadow] duration-(--duration) ease-(--ease-out)",
        "focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-45",
        "data-[state=checked]:border-brand data-[state=checked]:bg-brand data-[state=checked]:shadow-glow",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-3 rounded-full bg-foreground shadow-sm",
          "transition-transform duration-(--duration) ease-(--ease-out)",
          "data-[state=checked]:translate-x-3 data-[state=checked]:bg-brand-foreground",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
