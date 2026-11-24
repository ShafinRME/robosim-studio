import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@robosim/ui/lib/utils";

const badgeVariants = cva(
  "inline-flex h-5 items-center gap-1.5 rounded-sm border px-1.5 font-mono text-2xs font-medium tracking-wider whitespace-nowrap uppercase",
  {
    variants: {
      tone: {
        neutral: "border-border-strong bg-surface-3 text-muted-foreground",
        brand: "border-brand/40 bg-brand-soft text-brand",
        highlight: "border-highlight/40 bg-highlight-soft text-highlight",
        success: "border-success/40 bg-success/12 text-success",
        warning: "border-warning/40 bg-warning/12 text-warning",
        danger: "border-danger/40 bg-danger/12 text-danger",
        info: "border-info/40 bg-info/12 text-info",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

type BadgeProps = ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    /** Show a status LED before the label. `pulse` animates it (e.g. "Running"). */
    led?: boolean | "pulse";
  };

function Badge({ className, tone, led = false, children, ...props }: BadgeProps) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ tone }), className)} {...props}>
      {led ? (
        <span
          aria-hidden
          className={cn(
            "size-1.5 rounded-full bg-current shadow-[0_0_6px_currentColor]",
            led === "pulse" && "animate-pulse",
          )}
        />
      ) : null}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
