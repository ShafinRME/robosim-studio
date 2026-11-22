import { APP_VERSION, LABS } from "@robosim/core";
import Link from "next/link";
import { Button } from "@robosim/ui/components/button";
import { LogoMark } from "@robosim/ui/components/logo";

export default function HomePage() {
  return (
    <main className="flex min-h-screen bg-blueprint">
      <div className="mx-auto flex max-w-2xl flex-col items-center justify-center gap-6 px-8 py-16 text-center">
        <LogoMark className="size-16" />
        <h1 className="text-4xl font-bold tracking-tight">RoboSim Studio</h1>
        <p className="text-lg text-muted-foreground">
          A free, open-source robotics lab that runs in your browser.
        </p>
        <div className="flex gap-3">
          <Button asChild>
            <Link href="/studio">Open the studio</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/ui-kit">UI kit</Link>
          </Button>
        </div>
        <ol className="grid w-full grid-cols-2 gap-2 text-left text-sm">
          {LABS.map((lab, i) => (
            <li key={lab.id} className="rounded-md border bg-surface-1 px-3 py-2">
              <span className="font-mono text-faint-foreground">
                {String(i + 1).padStart(2, "0")}
              </span>{" "}
              {lab.name}{" "}
              <span className="font-mono text-2xs text-muted-foreground">· P{lab.phase}</span>
            </li>
          ))}
        </ol>
        <p className="font-mono text-xs text-muted-foreground">
          v{APP_VERSION} · Phase 0 — Foundation · Studio workspace
        </p>
      </div>
    </main>
  );
}
