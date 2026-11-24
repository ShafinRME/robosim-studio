import type { ComponentProps, ReactNode } from "react";
import { cn } from "@robosim/ui/lib/utils";

/**
 * Workspace panel (parts list, inspector, scope, serial monitor…).
 * Raised surface with a hairline edge; a faint top highlight gives it an instrument-bezel feel.
 * Day 06 docks these inside the studio shell.
 */
function Panel({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      data-slot="panel"
      className={cn(
        "relative flex min-h-0 flex-col overflow-hidden rounded-lg bg-surface-1 shadow-panel",
        "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-brand/35 before:to-transparent",
        className,
      )}
      {...props}
    />
  );
}

/** Panel title bar: optional icon, mono uppercase title, optional meta text and actions on the right. */
function PanelHeader({
  title,
  icon,
  meta,
  actions,
  className,
  ...props
}: Omit<ComponentProps<"header">, "title"> & {
  title: ReactNode;
  icon?: ReactNode;
  /** Small secondary text, e.g. a count ("12 parts") or a status. */
  meta?: ReactNode;
  /** Usually a few small IconButtons. */
  actions?: ReactNode;
}) {
  return (
    <header
      data-slot="panel-header"
      className={cn(
        "flex h-(--panel-header-h) shrink-0 items-center gap-2 border-b px-2.5",
        "[&_[data-slot=panel-icon]_svg]:size-3.5",
        className,
      )}
      {...props}
    >
      {icon ? (
        <span data-slot="panel-icon" className="flex text-brand" aria-hidden>
          {icon}
        </span>
      ) : null}
      <h2 className="truncate font-mono text-2xs font-semibold tracking-[0.14em] text-foreground uppercase">
        {title}
      </h2>
      {meta ? (
        <span className="truncate font-mono text-2xs text-faint-foreground">{meta}</span>
      ) : null}
      {actions ? <div className="ml-auto flex items-center gap-0.5">{actions}</div> : null}
    </header>
  );
}

/** Scrollable panel content. */
function PanelBody({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="panel-body"
      className={cn("min-h-0 flex-1 overflow-auto", className)}
      {...props}
    />
  );
}

/** Thin status line at the bottom of a panel. */
function PanelFooter({ className, ...props }: ComponentProps<"footer">) {
  return (
    <footer
      data-slot="panel-footer"
      className={cn(
        "flex h-6 shrink-0 items-center gap-3 border-t px-2.5 font-mono text-2xs text-faint-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Panel, PanelBody, PanelFooter, PanelHeader };
