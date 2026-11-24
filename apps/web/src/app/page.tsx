import { APP_VERSION, LABS, type LabId } from "@robosim/core";
import { Button } from "@robosim/ui/components/button";
import { Logo } from "@robosim/ui/components/logo";
import { ThemeSwitcher } from "@robosim/ui/components/theme-switcher";
import {
  Boxes,
  Cpu,
  FileArchive,
  Gauge,
  Keyboard,
  LaptopMinimal,
  LayoutPanelLeft,
  Link2,
  LockKeyhole,
  Scale,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { LICENSE_URL, REPO_URL } from "../lib/links";
import { KernelPreview } from "./kernel-preview";

/** One line per lab: what it will let you do (all planned; see the phase badge). */
const LAB_TEXT: Record<LabId, string> = {
  circuit: "Build circuits on a breadboard and watch voltages and currents live.",
  microcontroller: "Program Arduino, ESP32 and Raspberry Pi Pico boards — without the hardware.",
  iot: "Connect boards to dashboards and cloud services over Wi-Fi and MQTT.",
  sensors: "Ultrasonic, IR, IMU, motors and servos with realistic behaviour and noise.",
  "robotics-2d": "Line followers, maze solvers and mobile robots on a 2D field.",
  control: "Tune PID and state-space controllers and see the response instantly.",
  power: "Converters, motor drivers and batteries, from switching to heat.",
  "robotics-3d": "Robot arms and vehicles with real physics, kinematics and sensors.",
  ros: "Learn ROS 2 nodes, topics and navigation in the browser.",
  gesture: "Move simulated and real robots with your hands, using the webcam.",
};

/** Built and working in this version (each is in the User Manual). */
const TODAY: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: LayoutPanelLeft,
    title: "A real workspace",
    text: "Dock, split, float and maximize panels; your layout is remembered.",
  },
  {
    icon: Cpu,
    title: "1 kHz simulation kernel",
    text: "Fixed steps in a background worker, so the page stays smooth.",
  },
  {
    icon: FileArchive,
    title: "Saved automatically",
    text: "Projects save in your browser as you work; export them as .rsim files.",
  },
  {
    icon: Link2,
    title: "Share by link",
    text: "Small projects travel inside the link itself — nothing is uploaded.",
  },
  {
    icon: Gauge,
    title: "Low-end mode",
    text: "Detects slower computers and switches to lighter settings by itself.",
  },
  {
    icon: Keyboard,
    title: "Keyboard first",
    text: "Command palette (Ctrl + K), shortcuts and Undo / Redo everywhere.",
  },
];

const PRINCIPLES: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Scale,
    title: "Free and open source",
    text: "MIT licence. No accounts, no paid tiers, no licence fees for schools or students.",
  },
  {
    icon: LockKeyhole,
    title: "Private by default",
    text: "Your projects stay in your own browser. Nothing is sent to a server.",
  },
  {
    icon: LaptopMinimal,
    title: "Made for ordinary laptops",
    text: "Designed for 8 GB of memory and integrated graphics — no install, no gaming PC.",
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-6">
          <Logo />
          <nav aria-label="Main" className="ml-auto flex items-center gap-1 text-sm">
            <Button variant="ghost" size="sm" asChild>
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
                GitHub
              </a>
            </Button>
            <Button size="sm" asChild>
              <Link href="/studio">Open the studio</Link>
            </Button>
          </nav>
          <ThemeSwitcher className="hidden md:flex" />
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b bg-blueprint">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 md:py-24 lg:grid-cols-[1.15fr_1fr]">
            <div className="flex flex-col items-start gap-6">
              <p className="rounded-full border bg-surface-1 px-3 py-1 font-mono text-xs text-muted-foreground">
                Free · Open source · Runs in your browser
              </p>
              <h1 className="text-5xl font-bold tracking-tight md:text-6xl">RoboSim Studio</h1>
              <p className="max-w-2xl text-xl text-muted-foreground">
                A complete robotics lab in your browser: circuits, microcontrollers, sensors,
                control, robots in 2D and 3D, ROS 2 and gesture control — from your first LED to
                your final-year project.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button size="lg" asChild>
                  <Link href="/studio">Open the studio</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
                    Source on GitHub
                  </a>
                </Button>
              </div>
              <p className="font-mono text-xs text-muted-foreground">
                v{APP_VERSION} preview · Phase 0: the studio foundation is ready; the labs arrive
                one by one from Phase 1.
              </p>
            </div>
            <KernelPreview />
          </div>
        </section>

        {/* What works today */}
        <section aria-labelledby="today" className="border-b">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <h2 id="today" className="text-2xl font-semibold tracking-tight">
              Ready today
            </h2>
            <p className="mt-2 text-muted-foreground">
              The foundation every lab is built on. Try it now in the studio.
            </p>
            <ul aria-label="Ready today" className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {TODAY.map(({ icon: Icon, title, text }) => (
                <li key={title} className="rounded-lg border bg-surface-1 p-5">
                  <Icon className="size-5 text-brand" aria-hidden />
                  <h3 className="mt-3 font-medium">{title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* The 10 labs */}
        <section aria-labelledby="labs" className="border-b bg-surface-1">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <h2 id="labs" className="text-2xl font-semibold tracking-tight">
              The 10 labs
            </h2>
            <p className="mt-2 text-muted-foreground">
              Planned, in this order. Each lab arrives in its phase, fully tested and documented.
            </p>
            <ol aria-label="The 10 labs" className="mt-8 grid gap-3 md:grid-cols-2">
              {LABS.map((lab, i) => (
                <li key={lab.id} className="flex gap-4 rounded-lg border bg-background p-4">
                  <span className="font-mono text-sm text-brand">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <h3 className="flex flex-wrap items-baseline gap-x-2 font-medium">
                      {lab.name}
                      <span className="font-mono text-xs font-normal text-muted-foreground">
                        Phase {lab.phase} · planned
                      </span>
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">{LAB_TEXT[lab.id]}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Principles */}
        <section aria-labelledby="principles">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <h2 id="principles" className="sr-only">
              Principles
            </h2>
            <ul aria-label="Principles" className="grid gap-8 md:grid-cols-3">
              {PRINCIPLES.map(({ icon: Icon, title, text }) => (
                <li key={title}>
                  <Icon className="size-6 text-brand" aria-hidden />
                  <h3 className="mt-3 font-medium">{title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{text}</p>
                </li>
              ))}
            </ul>
            <div className="mt-12 flex flex-col items-start gap-3 rounded-xl border bg-blueprint p-8 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="flex items-center gap-2 text-lg font-medium">
                  <Boxes className="size-5 text-brand" aria-hidden /> Start building
                </p>
                <p className="text-sm text-muted-foreground">
                  Nothing to install. Works on any desktop or laptop with a modern browser.
                </p>
              </div>
              <Button size="lg" asChild>
                <Link href="/studio">Open the studio</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-6 text-sm text-muted-foreground">
          <span className="font-mono">RoboSim Studio v{APP_VERSION}</span>
          <a
            href={LICENSE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground"
          >
            MIT licence
          </a>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground"
          >
            Source code
          </a>
          <Link href="/ui-kit" className="hover:text-foreground">
            UI kit
          </Link>
        </div>
      </footer>
    </div>
  );
}
