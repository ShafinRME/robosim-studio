"use client";

import { Menubar as MenubarPrimitive } from "radix-ui";
import { CheckIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@robosim/ui/lib/utils";

/** Application menu bar (File, Edit, View, Help). Arrow keys move between menus and items. */
function Menubar({ className, ...props }: ComponentProps<typeof MenubarPrimitive.Root>) {
  return (
    <MenubarPrimitive.Root
      data-slot="menubar"
      className={cn("flex h-full items-center gap-0.5", className)}
      {...props}
    />
  );
}

const MenubarMenu = MenubarPrimitive.Menu;

function MenubarTrigger({ className, ...props }: ComponentProps<typeof MenubarPrimitive.Trigger>) {
  return (
    <MenubarPrimitive.Trigger
      data-slot="menubar-trigger"
      className={cn(
        "flex h-(--control-h-sm) items-center rounded-sm px-2 text-xs text-muted-foreground outline-none select-none",
        "transition-colors duration-(--duration-fast) hover:bg-surface-3 hover:text-foreground",
        "focus-visible:outline-2 data-[state=open]:bg-surface-3 data-[state=open]:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

function MenubarContent({
  className,
  align = "start",
  sideOffset = 6,
  ...props
}: ComponentProps<typeof MenubarPrimitive.Content>) {
  return (
    <MenubarPrimitive.Portal>
      <MenubarPrimitive.Content
        data-slot="menubar-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-52 overflow-hidden rounded-md bg-surface-2 p-1 text-foreground shadow-popover",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          className,
        )}
        {...props}
      />
    </MenubarPrimitive.Portal>
  );
}

const itemClass = cn(
  "relative flex h-7 w-full cursor-default items-center gap-2 rounded-sm px-2 text-xs outline-none select-none",
  "data-[disabled]:pointer-events-none data-[disabled]:opacity-45 data-[highlighted]:bg-brand-soft",
  "[&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
);

function MenubarItem({ className, ...props }: ComponentProps<typeof MenubarPrimitive.Item>) {
  return (
    <MenubarPrimitive.Item
      data-slot="menubar-item"
      className={cn(itemClass, className)}
      {...props}
    />
  );
}

function MenubarCheckboxItem({
  className,
  children,
  ...props
}: ComponentProps<typeof MenubarPrimitive.CheckboxItem>) {
  return (
    <MenubarPrimitive.CheckboxItem
      data-slot="menubar-checkbox-item"
      className={cn(itemClass, "pl-7", className)}
      {...props}
    >
      <span className="absolute left-2 flex size-3.5 items-center justify-center">
        <MenubarPrimitive.ItemIndicator>
          <CheckIcon className="text-brand!" />
        </MenubarPrimitive.ItemIndicator>
      </span>
      {children}
    </MenubarPrimitive.CheckboxItem>
  );
}

function MenubarLabel({ className, ...props }: ComponentProps<typeof MenubarPrimitive.Label>) {
  return (
    <MenubarPrimitive.Label
      data-slot="menubar-label"
      className={cn(
        "px-2 pt-1.5 pb-1 font-mono text-2xs tracking-wider text-faint-foreground uppercase",
        className,
      )}
      {...props}
    />
  );
}

function MenubarSeparator({
  className,
  ...props
}: ComponentProps<typeof MenubarPrimitive.Separator>) {
  return (
    <MenubarPrimitive.Separator
      data-slot="menubar-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

/** Right-aligned hint inside a menu item (a shortcut or a short note). */
function MenubarHint({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      data-slot="menubar-hint"
      className={cn("ml-auto pl-4 font-mono text-2xs text-faint-foreground", className)}
      {...props}
    />
  );
}

export {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarHint,
  MenubarItem,
  MenubarLabel,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
};
