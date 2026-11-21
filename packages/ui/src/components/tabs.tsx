"use client";

import { Tabs as TabsPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@robosim/ui/lib/utils";

function Tabs({ className, ...props }: ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-3", className)}
      {...props}
    />
  );
}

/** Instrument-style tab strip: mono labels on a hairline, active tab lit with a teal signal bar. */
function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn("inline-flex h-8 items-end gap-1 border-b", className)}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative -mb-px inline-flex h-full items-center gap-1.5 px-2.5 font-mono text-2xs font-medium tracking-wider whitespace-nowrap text-muted-foreground uppercase",
        "transition-colors duration-(--duration-fast) hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2",
        "after:absolute after:inset-x-1 after:bottom-0 after:h-0.5 after:rounded-full after:bg-transparent after:transition-colors",
        "data-[state=active]:text-brand data-[state=active]:after:bg-brand data-[state=active]:after:shadow-glow",
        "disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-3.5",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
