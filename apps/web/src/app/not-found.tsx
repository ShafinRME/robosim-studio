import { Button } from "@robosim/ui/components/button";
import type { Metadata } from "next";
import Link from "next/link";
import { ErrorScreen } from "../components/error-screen";

export const metadata: Metadata = { title: "Page not found · RoboSim Studio" };

export default function NotFound() {
  return (
    <ErrorScreen
      title="Page not found"
      actions={
        <>
          <Button asChild>
            <Link href="/studio">Open the studio</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">Home page</Link>
          </Button>
        </>
      }
    >
      <p>There is no page at this address. It may have moved, or the link may be mistyped.</p>
    </ErrorScreen>
  );
}
