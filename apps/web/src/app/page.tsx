import { APP_NAME, APP_VERSION, LABS } from "@robosim/core";
import { Button } from "@robosim/ui/components/button";
import { Cpu } from "lucide-react";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-8 py-16 text-center">
      <Cpu className="size-12 text-muted-foreground" aria-hidden />
      <h1 className="text-4xl font-bold tracking-tight">{APP_NAME}</h1>
      <p className="text-lg text-muted-foreground">
        A free, open-source robotics lab that runs in your browser.
      </p>
      <div className="flex gap-3">
        <Button>Primary button</Button>
        <Button variant="outline">Outline button</Button>
      </div>
      <ol className="grid w-full grid-cols-2 gap-2 text-left text-sm">
        {LABS.map((lab, i) => (
          <li key={lab.id} className="rounded-md border px-3 py-2">
            <span className="text-muted-foreground">{i + 1}.</span> {lab.name}{" "}
            <span className="text-muted-foreground">· P{lab.phase}</span>
          </li>
        ))}
      </ol>
      <p className="text-sm text-muted-foreground">
        v{APP_VERSION} · Phase 0 — Foundation · @robosim/core + @robosim/ui ✓
      </p>
    </main>
  );
}
