import type { ComponentProps } from "react";
import { cn } from "@robosim/ui/lib/utils";

/** A keyboard key, e.g. <Kbd>Ctrl</Kbd><Kbd>K</Kbd>. */
function Kbd({ className, ...props }: ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-b-2 border-border-strong bg-surface-3 px-1",
        "font-mono text-2xs font-medium text-muted-foreground select-none",
        className,
      )}
      {...props}
    />
  );
}

function KbdGroup({ className, ...props }: ComponentProps<"span">) {
  return <span className={cn("inline-flex items-center gap-0.5", className)} {...props} />;
}

export { Kbd, KbdGroup };
