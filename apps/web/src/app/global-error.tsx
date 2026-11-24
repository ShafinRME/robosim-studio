"use client";

import { useEffect } from "react";
import "@robosim/ui/globals.css";

/**
 * Last line of defence: shown when even the root layout fails. It replaces the whole page, so it
 * brings its own <html> and <body> and depends on nothing that might be broken (no theme provider,
 * no shared components).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-background p-6 font-sans text-foreground">
        <main className="flex max-w-md flex-col items-center gap-4 text-center">
          <h1 className="text-xl font-semibold">RoboSim Studio could not start</h1>
          <p className="text-sm text-muted-foreground">
            Something went wrong while loading. Your projects are saved in this browser and are not
            affected.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={reset}
              className="rounded-md bg-brand px-3 py-1.5 text-sm text-brand-foreground"
            >
              Try again
            </button>
            {/* A full reload, not client navigation: the app's own code may be what failed. */}
            <a href="/" className="rounded-md border px-3 py-1.5 text-sm">
              Reload
            </a>
          </div>
          {error.digest && (
            <p className="font-mono text-xs text-muted-foreground">Error code: {error.digest}</p>
          )}
        </main>
      </body>
    </html>
  );
}
