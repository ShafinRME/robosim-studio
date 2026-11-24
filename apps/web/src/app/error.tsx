"use client";

import { Button } from "@robosim/ui/components/button";
import Link from "next/link";
import { useEffect } from "react";
import { ErrorScreen } from "../components/error-screen";
import { ISSUES_URL } from "../lib/links";

/** Shown when a page crashes (Next.js error boundary for every route). */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Page error:", error);
  }, [error]);

  return (
    <ErrorScreen
      title="Something went wrong"
      code={error.digest}
      actions={
        <>
          <Button onClick={reset}>Try again</Button>
          <Button variant="outline" asChild>
            <Link href="/">Home page</Link>
          </Button>
          <Button variant="ghost" asChild>
            <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer">
              Report a problem
            </a>
          </Button>
        </>
      }
    >
      <p>This page stopped working. Trying again usually helps.</p>
    </ErrorScreen>
  );
}
