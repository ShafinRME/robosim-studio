import { LogoMark } from "@robosim/ui/components/logo";
import { cn } from "@robosim/ui/lib/utils";
import type { ReactNode } from "react";

/**
 * Friendly full-page message for errors and missing pages: what happened, what is safe, what to do.
 * Never shows technical details beyond a short error code (no stack traces, no file paths).
 */
export function ErrorScreen({
  title,
  children,
  actions,
  code,
  className,
}: {
  title: string;
  children: ReactNode;
  actions: ReactNode;
  /** Short error code from the server (Next.js digest), to quote in a problem report. */
  code?: string;
  className?: string;
}) {
  return (
    <main
      className={cn(
        "flex min-h-screen items-center justify-center bg-blueprint px-6 py-16",
        className,
      )}
    >
      <div className="flex max-w-md flex-col items-center gap-4 rounded-xl border bg-surface-1 px-8 py-10 text-center shadow-lg">
        <LogoMark className="size-12" />
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <div className="flex flex-col gap-2 text-sm text-muted-foreground">{children}</div>
        <div className="mt-2 flex flex-wrap justify-center gap-2">{actions}</div>
        {code && (
          <p className="font-mono text-2xs text-faint-foreground">
            Error code: <span className="select-all">{code.slice(0, 40)}</span>
          </p>
        )}
      </div>
    </main>
  );
}
