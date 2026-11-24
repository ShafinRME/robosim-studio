"use client";

import { Toolbar as ToolbarPrimitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { Kbd } from "@robosim/ui/components/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@robosim/ui/components/tooltip";
import { cn } from "@robosim/ui/lib/utils";

/**
 * Workspace toolbar. Accessible by design: one Tab stop for the whole bar, then ←/→ move between
 * tools (roving focus, WAI-ARIA toolbar pattern via Radix).
 */
function Toolbar({ className, ...props }: ComponentProps<typeof ToolbarPrimitive.Root>) {
  return (
    <ToolbarPrimitive.Root
      data-slot="toolbar"
      className={cn(
        "flex h-(--toolbar-h) shrink-0 items-center gap-1 border-b bg-surface-1 px-1.5",
        className,
      )}
      {...props}
    />
  );
}

/** Groups related tools in a slightly inset tray. */
function ToolbarGroup({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="toolbar-group"
      className={cn("flex items-center gap-0.5 rounded-md bg-canvas/60 p-0.5", className)}
      {...props}
    />
  );
}

function ToolbarSeparator({
  className,
  ...props
}: ComponentProps<typeof ToolbarPrimitive.Separator>) {
  return (
    <ToolbarPrimitive.Separator
      data-slot="toolbar-separator"
      className={cn("mx-1 h-5 w-px bg-border", className)}
      {...props}
    />
  );
}

const toolClass = cn(
  "inline-flex size-(--control-h) shrink-0 items-center justify-center rounded-md text-muted-foreground",
  "transition-[color,background-color,box-shadow] duration-(--duration-fast)",
  "hover:bg-surface-3 hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2",
  "disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4",
  "data-[state=on]:bg-brand-soft data-[state=on]:text-brand data-[state=on]:shadow-glow",
  "aria-pressed:bg-brand-soft aria-pressed:text-brand",
);

/** Tooltip with the tool name and an optional shortcut. */
function ToolTip({
  label,
  shortcut,
  children,
}: {
  label: string;
  shortcut?: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom">
        {label}
        {shortcut ? <Kbd>{shortcut}</Kbd> : null}
      </TooltipContent>
    </Tooltip>
  );
}

/** Icon tool button. `label` is required: it is the accessible name and the tooltip text. */
function ToolbarButton({
  label,
  shortcut,
  className,
  children,
  ...props
}: Omit<ComponentProps<typeof ToolbarPrimitive.Button>, "aria-label"> & {
  label: string;
  shortcut?: string;
}) {
  return (
    <ToolTip label={label} shortcut={shortcut}>
      <ToolbarPrimitive.Button
        data-slot="toolbar-button"
        aria-label={label}
        className={cn(toolClass, className)}
        {...props}
      >
        {children}
      </ToolbarPrimitive.Button>
    </ToolTip>
  );
}

/** Mutually exclusive tools (select / wire / pan…). */
function ToolbarToggleGroup({
  className,
  ...props
}: ComponentProps<typeof ToolbarPrimitive.ToggleGroup>) {
  return (
    <ToolbarPrimitive.ToggleGroup
      data-slot="toolbar-toggle-group"
      className={cn("flex items-center gap-0.5 rounded-md bg-canvas/60 p-0.5", className)}
      {...props}
    />
  );
}

function ToolbarToggleItem({
  label,
  shortcut,
  className,
  children,
  ...props
}: Omit<ComponentProps<typeof ToolbarPrimitive.ToggleItem>, "aria-label"> & {
  label: string;
  shortcut?: string;
}) {
  return (
    <ToolTip label={label} shortcut={shortcut}>
      <ToolbarPrimitive.ToggleItem
        data-slot="toolbar-toggle-item"
        aria-label={label}
        className={cn(toolClass, className)}
        {...props}
      >
        {children}
      </ToolbarPrimitive.ToggleItem>
    </ToolTip>
  );
}

/** Free-form slot (e.g. a zoom read-out) that still sits in the toolbar's focus order when focusable. */
function ToolbarSpacer() {
  return <div aria-hidden className="flex-1" />;
}

export {
  Toolbar,
  ToolbarButton,
  ToolbarGroup,
  ToolbarSeparator,
  ToolbarSpacer,
  ToolbarToggleGroup,
  ToolbarToggleItem,
};
