"use client";

import { ChevronRight } from "lucide-react";
import { Accordion as AccordionPrimitive } from "radix-ui";
import { useId, type ReactNode } from "react";
import { cn } from "@robosim/ui/lib/utils";

/**
 * Property inspector: collapsible sections of label → control rows, like the property grids in
 * professional CAD / simulation tools. Sections stay open independently (`type="multiple"`).
 */
function Inspector({
  className,
  defaultOpen,
  open,
  onOpenChange,
  children,
}: {
  className?: string;
  children: ReactNode;
  /** Ids of the sections open at first render (uncontrolled). */
  defaultOpen?: string[];
  /** Ids of the open sections (controlled). */
  open?: string[];
  onOpenChange?: (open: string[]) => void;
}) {
  return (
    <AccordionPrimitive.Root
      data-slot="inspector"
      type="multiple"
      defaultValue={defaultOpen}
      value={open}
      onValueChange={onOpenChange}
      className={cn("flex flex-col", className)}
    >
      {children}
    </AccordionPrimitive.Root>
  );
}

function InspectorSection({
  id,
  title,
  meta,
  children,
  className,
}: {
  id: string;
  title: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <AccordionPrimitive.Item
      value={id}
      data-slot="inspector-section"
      className={cn("border-b last:border-b-0", className)}
    >
      <AccordionPrimitive.Header className="flex">
        <AccordionPrimitive.Trigger
          className={cn(
            "group flex h-7 flex-1 items-center gap-1.5 px-2.5 text-left font-mono text-2xs font-semibold tracking-[0.12em] text-muted-foreground uppercase",
            "hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2",
          )}
        >
          <ChevronRight
            aria-hidden
            className="size-3 transition-transform duration-(--duration-fast) group-data-[state=open]:rotate-90"
          />
          {title}
          {meta ? (
            <span className="ml-auto font-normal tracking-normal text-faint-foreground normal-case">
              {meta}
            </span>
          ) : null}
        </AccordionPrimitive.Trigger>
      </AccordionPrimitive.Header>
      <AccordionPrimitive.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
        <div className="flex flex-col gap-1 px-2.5 pt-0.5 pb-2.5">{children}</div>
      </AccordionPrimitive.Content>
    </AccordionPrimitive.Item>
  );
}

/**
 * One property. The label is linked to the control (pass the control as a function to receive the
 * generated id, or give the control `id` yourself).
 */
function InspectorRow({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode | ((id: string) => ReactNode);
  className?: string;
}) {
  const id = useId();
  return (
    <div
      data-slot="inspector-row"
      className={cn("grid min-h-(--control-h) grid-cols-[42%_1fr] items-center gap-2", className)}
    >
      <label htmlFor={id} title={hint} className="truncate text-xs text-muted-foreground">
        {label}
      </label>
      <div className="min-w-0">{typeof children === "function" ? children(id) : children}</div>
    </div>
  );
}

/** Read-only live value (simulation results): mono, tabular, tinted by `tone`. */
function InspectorValue({
  children,
  tone = "brand",
  className,
}: {
  children: ReactNode;
  tone?: "brand" | "muted" | "warning" | "danger";
  className?: string;
}) {
  return (
    <output
      className={cn(
        "tabular flex h-(--control-h) items-center rounded-md px-2 font-mono text-[0.8125rem]",
        tone === "brand" && "bg-brand-soft text-brand",
        tone === "muted" && "bg-surface-3 text-muted-foreground",
        tone === "warning" && "bg-warning/12 text-warning",
        tone === "danger" && "bg-danger/12 text-danger",
        className,
      )}
    >
      {children}
    </output>
  );
}

export { Inspector, InspectorRow, InspectorSection, InspectorValue };
