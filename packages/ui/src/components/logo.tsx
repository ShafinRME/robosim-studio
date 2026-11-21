import { useId, type SVGProps } from "react";
import { cn } from "@robosim/ui/lib/utils";

/** Copper servo gear at the frame origin (8 teeth, generated on a 64 px grid). */
const GEAR_PATH =
  "M32.00 27.90L32.62 26.43L33.94 26.69L33.95 28.29L35.61 29.39L37.09 28.79L37.83 29.91L36.71 31.05L37.10 33.00L38.57 33.62L38.31 34.94L36.71 34.95L35.61 36.61L36.21 38.09L35.09 38.83L33.95 37.71L32.00 38.10L31.38 39.57L30.06 39.31L30.05 37.71L28.39 36.61L26.91 37.21L26.17 36.09L27.29 34.95L26.90 33.00L25.43 32.38L25.69 31.06L27.29 31.05L28.39 29.39L27.79 27.91L28.91 27.17L30.05 28.29Z";

/**
 * RoboSim Studio logo — "Kinematic Frame".
 * A wireframe simulation cube (the virtual world) with joint nodes on its corners; at its centre a
 * robot's coordinate frame — X (coral), Y (green), Z (teal) — driven by a copper servo gear, with a
 * revolute-joint arrow around Z. It says robotics (joints, frames, kinematics), simulation (3D
 * world) and digital (blueprint grid, glow) at once. Original artwork, owner-approved (ADR 002).
 * Static copy for the favicon: apps/web/src/app/icon.svg (keep both in sync).
 */
export function LogoMark({
  title = "RoboSim Studio",
  className,
  ...props
}: SVGProps<SVGSVGElement> & { title?: string }) {
  const uid = useId().replace(/:/g, "");
  const decorative = title === "";
  const ids = {
    tile: `${uid}tile`,
    face: `${uid}face`,
    copper: `${uid}cu`,
    glow: `${uid}glow`,
    grid: `${uid}grid`,
  };
  const url = (id: string) => `url(#${id})`;
  const corners: [number, number][] = [
    [32, 12],
    [50.2, 22.5],
    [50.2, 43.5],
    [32, 54],
    [13.8, 43.5],
    [13.8, 22.5],
  ];
  return (
    <svg
      viewBox="0 0 64 64"
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : title}
      aria-hidden={decorative ? true : undefined}
      className={cn("size-8 shrink-0", className)}
      {...props}
    >
      {decorative ? null : <title>{title}</title>}
      <defs>
        <linearGradient id={ids.tile} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#16263f" />
          <stop offset="1" stopColor="#080d17" />
        </linearGradient>
        <linearGradient id={ids.face} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#40e8f2" stopOpacity="0.2" />
          <stop offset="1" stopColor="#2a6dff" stopOpacity="0.06" />
        </linearGradient>
        <linearGradient id={ids.copper} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffc58a" />
          <stop offset="1" stopColor="#e98a32" />
        </linearGradient>
        <radialGradient id={ids.glow}>
          <stop offset="0" stopColor="#40e8f2" stopOpacity="0.45" />
          <stop offset="1" stopColor="#40e8f2" stopOpacity="0" />
        </radialGradient>
        <pattern id={ids.grid} width="8" height="8" patternUnits="userSpaceOnUse">
          <circle cx="4" cy="4" r="0.55" fill="#a8bde0" fillOpacity="0.15" />
        </pattern>
      </defs>
      {/* tile: ink, blueprint dots, hairline edge */}
      <rect x="2" y="2" width="60" height="60" rx="15" fill={url(ids.tile)} />
      <rect x="2" y="2" width="60" height="60" rx="15" fill={url(ids.grid)} />
      <rect
        x="2.6"
        y="2.6"
        width="58.8"
        height="58.8"
        rx="14.4"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.12"
        strokeWidth="1.2"
      />
      {/* simulation cube: glass faces, hidden edges dashed, joint nodes on the corners */}
      <path
        d="M32 12 50.2 22.5v21L32 54 13.8 43.5v-21z"
        fill={url(ids.face)}
        stroke="#40e8f2"
        strokeOpacity="0.7"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M13.8 22.5 32 33l18.2-10.5M32 33v21"
        fill="none"
        stroke="#40e8f2"
        strokeOpacity="0.32"
        strokeWidth="1.1"
        strokeDasharray="2 2"
      />
      <g fill="#0b1320" stroke="#40e8f2" strokeWidth="1">
        {corners.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1.55" />
        ))}
      </g>
      <circle cx="32" cy="33" r="13" fill={url(ids.glow)} />
      {/* coordinate frame: Z teal, X coral, Y green */}
      <g strokeLinecap="round" strokeWidth="3">
        <path d="M32 26V17.5" stroke="#40e8f2" />
        <path d="M37.6 36.2l7.4 4.3" stroke="#ff7a59" />
        <path d="M26.4 36.2 19 40.5" stroke="#7ee08a" />
      </g>
      <path d="m32 13.6-3.3 5.2h6.6z" fill="#40e8f2" />
      <path d="m48.4 42.4-6.1-.1 3.3-5.7z" fill="#ff7a59" />
      <path d="m15.6 42.4 3-5.8 3.1 5.7z" fill="#7ee08a" />
      {/* revolute joint: rotation about Z */}
      <g transform="translate(32 22.4) scale(0.8) translate(-32 -22.4)" opacity="0.92">
        <path
          d="M26 21.6a6.2 2.3 0 1 0 11.7 1.4"
          fill="none"
          stroke="#bff6fb"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path d="m38.9 20.6-.9 3.4-3.1-1.6z" fill="#bff6fb" />
      </g>
      {/* copper servo gear at the origin */}
      <path
        d={GEAR_PATH}
        fill={url(ids.copper)}
        stroke="#b5641f"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="33" r="3.2" fill="#0b1320" />
      <circle cx="32" cy="33" r="1.25" fill="#e9fbff" />
    </svg>
  );
}

/** Logo mark + wordmark. `RoboSim` in Plex Sans, `STUDIO` as a mono signal tag. */
export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={markClassName} title="" />
      <span className="flex items-baseline gap-1.5 leading-none" aria-hidden>
        <span className="text-[1.0625rem] font-semibold tracking-tight text-foreground">
          RoboSim
        </span>
        <span className="rounded-sm border border-brand/40 px-1 py-px font-mono text-[0.625rem] font-medium tracking-[0.2em] text-brand">
          STUDIO
        </span>
      </span>
      <span className="sr-only">RoboSim Studio</span>
    </span>
  );
}
