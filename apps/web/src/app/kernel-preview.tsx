import { DEMO_SIGNALS, createDemoModels, createSimulation } from "@robosim/core";

const WIDTH = 480;
const HEIGHT = 220;
const PAD = { left: 40, right: 12, top: 16, bottom: 28 };
const SECONDS = 6;
const SAMPLE_EVERY = 20; // steps (20 ms)
const Y_MAX = 0.2; // m

/**
 * Runs the real demo simulation (the same kernel as the studio) for 6 s and samples it. Called while
 * the page is built on the server, so visitors download a finished picture, not a simulation.
 */
function trace() {
  const sim = createSimulation(createDemoModels());
  const position: [number, number][] = [];
  const driveOn: [number, number][] = [];
  let start: number | null = null;
  for (let step = 0; step <= SECONDS * 1000; step += SAMPLE_EVERY) {
    if (step > 0) sim.step(SAMPLE_EVERY);
    const t = step / 1000;
    position.push([t, sim.bus.readNumber(DEMO_SIGNALS.position)]);
    const on = sim.bus.readBoolean(DEMO_SIGNALS.drive);
    if (on && start === null) start = t;
    if (!on && start !== null) {
      driveOn.push([start, t]);
      start = null;
    }
  }
  if (start !== null) driveOn.push([start, SECONDS]);
  return { position, driveOn };
}

const x = (t: number) => PAD.left + (t / SECONDS) * (WIDTH - PAD.left - PAD.right);
const y = (m: number) =>
  PAD.top + (1 - (m + 0.05) / (Y_MAX + 0.05)) * (HEIGHT - PAD.top - PAD.bottom);

/** Hero picture: real output of the 1 kHz simulation kernel. */
export function KernelPreview() {
  const { position, driveOn } = trace();
  const path = position
    .map(([t, m], i) => `${i ? "L" : "M"}${x(t).toFixed(1)},${y(m).toFixed(1)}`)
    .join("");

  return (
    <figure className="w-full rounded-xl border bg-surface-1 p-4 shadow-lg">
      <figcaption className="mb-2 flex items-center justify-between font-mono text-2xs text-muted-foreground">
        <span>demo.position · spring + switching force</span>
        <span className="text-brand">1 kHz kernel</span>
      </figcaption>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Chart: the demo spring's position over 6 seconds. It rises towards 0.1 m while the force is on, overshoots, and swings back to 0 when the force switches off."
        className="h-auto w-full"
      >
        {driveOn.map(([a, b]) => (
          <rect
            key={a}
            x={x(a)}
            y={PAD.top}
            width={x(b) - x(a)}
            height={HEIGHT - PAD.top - PAD.bottom}
            className="fill-brand/8"
          />
        ))}
        {[0, 0.1, 0.2].map((m) => (
          <g key={m}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y(m)}
              y2={y(m)}
              className="stroke-border"
              strokeDasharray={m === 0 ? undefined : "3 4"}
            />
            <text
              x={PAD.left - 6}
              y={y(m) + 3}
              textAnchor="end"
              className="fill-muted-foreground font-mono text-[10px]"
            >
              {m.toFixed(1)}
            </text>
          </g>
        ))}
        {[0, 2, 4, 6].map((t) => (
          <text
            key={t}
            x={x(t)}
            y={HEIGHT - 10}
            textAnchor="middle"
            className="fill-muted-foreground font-mono text-[10px]"
          >
            {t} s
          </text>
        ))}
        <path
          d={path}
          fill="none"
          className="stroke-brand"
          strokeWidth={2}
          strokeLinejoin="round"
        />
      </svg>
      <p className="mt-2 font-mono text-2xs text-muted-foreground">
        <span className="mr-1 inline-block size-2 rounded-sm bg-brand/20 align-middle" /> force on
        <span className="mx-2">·</span>position in metres
      </p>
    </figure>
  );
}
