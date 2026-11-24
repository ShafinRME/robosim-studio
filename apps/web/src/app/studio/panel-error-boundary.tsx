"use client";

import { Button } from "@robosim/ui/components/button";
import { TriangleAlert } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Keeps one broken panel from taking down the whole studio: the panel shows a message and a
 * "Try again" button, everything else keeps working. (React only offers this as a class component.)
 */
export class PanelErrorBoundary extends Component<
  { title: string; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`Panel "${this.props.title}" stopped working:`, error, info.componentStack);
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div
        role="alert"
        className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center"
      >
        <TriangleAlert className="size-5 text-warning" aria-hidden />
        <p className="text-xs font-medium text-foreground">
          The {this.props.title} panel stopped working.
        </p>
        <p className="max-w-56 text-2xs text-muted-foreground">
          The rest of the studio is fine and your project is saved.
        </p>
        <Button size="sm" variant="outline" onClick={() => this.setState({ failed: false })}>
          Try again
        </Button>
      </div>
    );
  }
}

/**
 * Development-only switch for the error-screen tests: `/studio?crash=studio` or `?crash=inspector`
 * makes that part throw. The check is removed from production builds (NODE_ENV is replaced at
 * build time), so the published app has no way to trigger it.
 */
export function useDevCrash(part: string): void {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") return;
  if (new URLSearchParams(window.location.search).get("crash") === part) {
    throw new Error(`Test crash: ${part}`);
  }
}
