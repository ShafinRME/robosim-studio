import { APP_VERSION } from "@robosim/core";
import type { Metadata } from "next";
import { Logo, LogoMark } from "@robosim/ui/components/logo";
import { ThemeSwitcher } from "@robosim/ui/components/theme-switcher";
import { ROBOTICS_ICONS } from "@robosim/ui/icons/robotics";
import { ControlsDemo } from "./controls-demo";
import { WorkspaceDemo } from "./workspace-demo";
import {
  Activity,
  Cpu,
  FolderOpen,
  Hand,
  Layers,
  Pause,
  Play,
  Save,
  Settings2,
  StepForward,
  Terminal,
  Wifi,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";

export const metadata: Metadata = {
  title: "UI kit · RoboSim Studio",
  robots: { index: false },
};

type Swatch = { name: string; token: string; className: string; note?: string };

const SURFACES: Swatch[] = [
  {
    name: "Canvas",
    token: "--canvas",
    className: "bg-canvas",
    note: "App & simulation background",
  },
  { name: "Surface 1", token: "--surface-1", className: "bg-surface-1", note: "Panels" },
  { name: "Surface 2", token: "--surface-2", className: "bg-surface-2", note: "Raised, popovers" },
  { name: "Surface 3", token: "--surface-3", className: "bg-surface-3", note: "Hover, inputs" },
];

const BRAND: Swatch[] = [
  { name: "Signal teal", token: "--brand", className: "bg-brand", note: "Primary, focus, live" },
  { name: "Copper", token: "--highlight", className: "bg-highlight", note: "Emphasis, sparing" },
  { name: "Teal soft", token: "--brand-soft", className: "bg-brand-soft", note: "Selection" },
  { name: "Copper soft", token: "--highlight-soft", className: "bg-highlight-soft" },
];

const STATUS: Swatch[] = [
  { name: "Success", token: "--success", className: "bg-success" },
  { name: "Warning", token: "--warning", className: "bg-warning" },
  { name: "Danger", token: "--danger", className: "bg-danger" },
  { name: "Info", token: "--info", className: "bg-info" },
];

const CHANNELS: Swatch[] = [
  { name: "CH1", token: "--ch1", className: "bg-ch1" },
  { name: "CH2", token: "--ch2", className: "bg-ch2" },
  { name: "CH3", token: "--ch3", className: "bg-ch3" },
  { name: "CH4", token: "--ch4", className: "bg-ch4" },
];

const UI_ICONS = {
  Play,
  Pause,
  "Step forward": StepForward,
  Save,
  "Open project": FolderOpen,
  Layers,
  Settings: Settings2,
  Terminal,
  Signal: Activity,
  Chip: Cpu,
  "Wi-Fi": Wifi,
  Gesture: Hand,
};

const NAV: [id: string, label: string][] = [
  ["brand-mark", "Logo"],
  ["surfaces", "Colour"],
  ["type", "Type"],
  ["icons", "Icons"],
  ["workspace", "Workspace"],
  ["controls", "Controls"],
  ["shape", "Shape"],
];

const TYPE_SCALE = [
  { label: "2xs · 11", className: "text-2xs", sample: "Status bar · pin labels" },
  { label: "xs · 12", className: "text-xs", sample: "Inspector labels · tooltips" },
  { label: "sm · 14", className: "text-sm", sample: "Default UI text in panels" },
  { label: "base · 16", className: "text-base", sample: "Lesson body text" },
  { label: "xl · 20", className: "text-xl font-semibold", sample: "Panel & dialog titles" },
  { label: "3xl · 30", className: "text-3xl font-semibold tracking-tight", sample: "Page titles" },
];

const RADII = [
  { label: "sm", className: "rounded-sm" },
  { label: "md", className: "rounded-md" },
  { label: "lg", className: "rounded-lg" },
  { label: "xl", className: "rounded-xl" },
];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-16">
      <h2
        id={`${id}-title`}
        className="mb-3 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase"
      >
        {title}
      </h2>
      <div className="rounded-lg bg-surface-1 p-5 shadow-panel">{children}</div>
    </section>
  );
}

function SwatchGrid({ swatches }: { swatches: Swatch[] }) {
  return (
    <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {swatches.map((s) => (
        <li key={s.token} className="flex flex-col gap-2">
          <div className={`h-14 rounded-md border ${s.className}`} />
          <div className="leading-tight">
            <div className="text-sm font-medium">{s.name}</div>
            <code className="font-mono text-2xs text-faint-foreground">{s.token}</code>
            {s.note ? <div className="text-xs text-muted-foreground">{s.note}</div> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function IconGrid({
  icons,
  accent = false,
}: {
  icons: Record<string, ComponentType<{ className?: string }>>;
  accent?: boolean;
}) {
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
      {Object.entries(icons).map(([name, Icon]) => (
        <li
          key={name}
          className="group flex flex-col items-center gap-2 rounded-md border bg-surface-2 px-2 py-4 transition-colors duration-(--duration-fast) hover:border-brand/50 hover:bg-brand-soft"
        >
          <Icon
            className={
              accent
                ? "size-6 text-brand"
                : "size-6 text-muted-foreground group-hover:text-foreground"
            }
          />
          <span className="text-center font-mono text-2xs text-muted-foreground">{name}</span>
        </li>
      ))}
    </ul>
  );
}

export default function UiKitPage() {
  return (
    <div className="min-h-screen bg-blueprint">
      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-8 py-12">
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-2 font-mono text-2xs tracking-[0.2em] text-brand uppercase">
              <span className="size-1.5 rounded-full bg-brand shadow-glow" aria-hidden />
              Design system · v{APP_VERSION}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Signal UI kit</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Every colour, type size and component used in RoboSim Studio. Components only use
              these tokens, so the whole studio changes together.
            </p>
          </div>
          <ThemeSwitcher />
        </header>

        <nav
          aria-label="UI kit sections"
          className="sticky top-3 z-10 -mx-2 flex flex-wrap gap-1 rounded-lg border bg-surface-1/85 p-1 shadow-panel backdrop-blur"
        >
          {NAV.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className="rounded-md px-2 py-1 font-mono text-2xs tracking-wider text-muted-foreground uppercase transition-colors hover:bg-surface-3 hover:text-brand focus-visible:outline-2"
            >
              {label}
            </a>
          ))}
        </nav>

        <Section id="brand-mark" title="Logo">
          <div className="grid gap-4 md:grid-cols-[auto_1fr]">
            <div className="flex items-center justify-center rounded-md border bg-canvas p-8">
              <LogoMark className="size-32" />
            </div>
            <div className="grid gap-4">
              <div className="flex items-center justify-center rounded-md border bg-canvas p-6">
                <Logo markClassName="size-10" className="scale-125" />
              </div>
              <div className="flex items-end justify-center gap-5 rounded-md border bg-surface-2 p-6">
                {["size-4", "size-6", "size-8", "size-12", "size-16"].map((size) => (
                  <LogoMark key={size} className={size} />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                <span className="mr-2 font-mono text-2xs tracking-widest text-brand uppercase">
                  Kinematic Frame
                </span>
                A wireframe simulation cube with joint nodes; at its centre a robot coordinate frame
                (X coral, Y green, Z teal) driven by a copper servo gear, with a revolute-joint
                arrow around Z. Robotics, simulation and digital in one mark; recognisable from 16
                px.
              </p>
            </div>
          </div>
        </Section>

        <Section id="surfaces" title="Surfaces">
          <SwatchGrid swatches={SURFACES} />
        </Section>

        <Section id="brand" title="Brand & highlight">
          <SwatchGrid swatches={BRAND} />
        </Section>

        <div className="grid gap-10 md:grid-cols-2">
          <Section id="status" title="Status">
            <SwatchGrid swatches={STATUS} />
          </Section>
          <Section id="channels" title="Instrument channels">
            <SwatchGrid swatches={CHANNELS} />
          </Section>
        </div>

        <Section id="type" title="Typography — IBM Plex Sans & Mono">
          <ul className="flex flex-col divide-y">
            {TYPE_SCALE.map((t) => (
              <li key={t.label} className="flex items-baseline gap-6 py-3 first:pt-0 last:pb-0">
                <code className="w-20 shrink-0 font-mono text-2xs text-faint-foreground">
                  {t.label}
                </code>
                <span className={t.className}>{t.sample}</span>
              </li>
            ))}
            <li className="flex items-baseline gap-6 pt-3">
              <code className="w-20 shrink-0 font-mono text-2xs text-faint-foreground">mono</code>
              <span className="tabular font-mono text-sm">
                V<sub>out</sub> = 3.300 V · I = 12.45 mA · f = 1.000 kHz
              </span>
            </li>
          </ul>
        </Section>

        <Section id="icons" title="Icons — robotics set (ours) + Lucide UI icons">
          <div className="flex flex-col gap-6">
            <IconGrid icons={ROBOTICS_ICONS} accent />
            <IconGrid icons={UI_ICONS} />
          </div>
        </Section>

        <Section id="workspace" title="Workspace — panel · toolbar · inspector">
          <WorkspaceDemo />
        </Section>

        <Section id="controls" title="Controls">
          <ControlsDemo />
        </Section>

        <Section id="shape" title="Shape & density">
          <div className="flex flex-wrap items-end gap-8">
            {RADII.map((r) => (
              <div key={r.label} className="flex flex-col items-center gap-2">
                <div className={`size-14 border-2 border-brand bg-brand-soft ${r.className}`} />
                <code className="font-mono text-2xs text-faint-foreground">rounded-{r.label}</code>
              </div>
            ))}
            <div className="flex items-end gap-3">
              {[
                ["24", "h-(--control-h-sm)"],
                ["28", "h-(--control-h)"],
                ["36", "h-(--control-h-lg)"],
              ].map(([px, cls]) => (
                <div key={px} className="flex flex-col items-center gap-2">
                  <div className={`w-16 rounded-md bg-surface-3 ${cls}`} />
                  <code className="font-mono text-2xs text-faint-foreground">{px}px</code>
                </div>
              ))}
            </div>
          </div>
        </Section>
      </main>
    </div>
  );
}
