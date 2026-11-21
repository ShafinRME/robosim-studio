import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@robosim/ui/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap select-none",
    "transition-[color,background-color,border-color,box-shadow,transform] duration-(--duration-fast) ease-(--ease-out)",
    "focus-visible:outline-2 focus-visible:outline-offset-2 active:translate-y-px",
    "disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary: "bg-brand text-brand-foreground hover:shadow-glow hover:brightness-110",
        secondary: "bg-surface-3 text-foreground hover:bg-border-strong/60",
        outline:
          "border border-border-strong bg-transparent text-foreground hover:border-brand/60 hover:bg-brand-soft",
        ghost: "text-muted-foreground hover:bg-surface-3 hover:text-foreground",
        danger: "bg-danger text-white hover:brightness-110",
        link: "h-auto px-0 text-brand underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-(--control-h-sm) px-2 text-xs [&_svg]:size-3.5",
        md: "h-(--control-h) px-3 text-sm [&_svg]:size-4",
        lg: "h-(--control-h-lg) px-4 text-sm [&_svg]:size-4",
        "icon-sm": "size-(--control-h-sm) [&_svg]:size-3.5",
        icon: "size-(--control-h) [&_svg]:size-4",
        "icon-lg": "size-(--control-h-lg) [&_svg]:size-[1.125rem]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Render the child element (e.g. a link) with button styles. */
    asChild?: boolean;
  };

function Button({ className, variant, size, asChild = false, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      type={asChild ? undefined : (type ?? "button")}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

/** Square icon-only button. `label` is required so every icon button has an accessible name. */
function IconButton({
  label,
  size = "icon",
  variant = "ghost",
  ...props
}: Omit<ButtonProps, "size"> & { label: string; size?: "icon-sm" | "icon" | "icon-lg" }) {
  return <Button aria-label={label} title={label} size={size} variant={variant} {...props} />;
}

export { Button, IconButton, buttonVariants };
export type { ButtonProps };
