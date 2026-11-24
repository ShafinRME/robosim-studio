"use client";

import { Button } from "@robosim/ui/components/button";
import Link from "next/link";
import { useEffect } from "react";
import { ErrorScreen } from "../../components/error-screen";
import { ISSUES_URL } from "../../lib/links";

/** Shown when the studio itself crashes. Projects are saved, so the user can safely reload. */
export default function StudioError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Studio error:", error);
  }, [error]);

  return (
    <ErrorScreen
      title="The studio stopped working"
      code={error.digest}
      actions={
        <>
          <Button onClick={reset}>Try again</Button>
          {/* A full reload starts the studio fresh and reopens your saved projects. */}
          <Button variant="outline" onClick={() => window.location.reload()}>
            Reload the studio
          </Button>
          <Button variant="ghost" asChild>
            <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer">
              Report a problem
            </a>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/">Home page</Link>
          </Button>
        </>
      }
    >
      <p>Something unexpected happened.</p>
      <p>
        <strong className="text-foreground">Your projects are safe:</strong> they are saved in this
        browser and open again when the studio reloads (changes from the last second may be
        missing).
      </p>
    </ErrorScreen>
  );
}
