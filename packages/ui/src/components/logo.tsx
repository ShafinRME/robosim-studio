import { useId, type SVGProps } from "react";
import { cn } from "@robosim/ui/lib/utils";

/**
 * RoboSim Studio logo — "Signal Arm".
 * An industrial robot arm (base, pedestal, shoulder, upper arm, forearm, wrist) with copper joint
 * bearings and a two-finger gripper holding a glowing, orbiting object — the thing being simulated.
 * Teal→blue arm on a deep ink tile with a faint blueprint dot grid. Original artwork (ADR 002).
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
    arm: `${uid}arm`,
    orb: `${uid}orb`,
    halo: `${uid}halo`,
    grid: `${uid}grid`,
  };
  const url = (id: string) => `url(#${id})`;
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
        <linearGradient id={ids.arm} x1="16" y1="54" x2="50" y2="10" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2a6dff" />
          <stop offset="1" stopColor="#40e8f2" />
        </linearGradient>
        <radialGradient id={ids.orb} cx="0.38" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.3" stopColor="#9ff7fb" />
          <stop offset="1" stopColor="#11a9c4" />
        </radialGradient>
        <radialGradient id={ids.halo}>
          <stop offset="0" stopColor="#40e8f2" stopOpacity="0.5" />
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
      <g transform="translate(2.5 0)">
        {/* floor shadow, base plate, pedestal */}
        <ellipse cx="26" cy="55" rx="15" ry="2" fill="#000000" fillOpacity="0.4" />
        <rect x="14" y="50.5" width="24" height="4.6" rx="2.3" fill={url(ids.arm)} />
        <path
          d="M20 51 22 43h8l2 8z"
          fill={url(ids.arm)}
          stroke={url(ids.arm)}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* links and parallel two-finger gripper */}
        <g fill="none" stroke={url(ids.arm)} strokeLinecap="round">
          <path d="M26 41.5 19.5 22.5" strokeWidth="8.4" />
          <path d="M19.5 22.5 40.5 14.5" strokeWidth="6.6" />
          <path d="M40.5 14.5 45.5 20.5" strokeWidth="5" />
          <path d="M42.4 23.4 49.3 17.6M42.4 23.4l3.2 3.8M49.3 17.6l3.2 3.8" strokeWidth="2.6" />
        </g>
        {/* highlights for depth */}
        <g
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.28"
          strokeLinecap="round"
          strokeWidth="1.1"
        >
          <path d="M23.4 39.2 17.9 23.4M21.6 19.9l17.2-6.6" />
        </g>
        {/* the simulated object: glowing orb with an orbit */}
        <circle cx="50.6" cy="26.2" r="9" fill={url(ids.halo)} />
        <ellipse
          cx="50.6"
          cy="26.2"
          rx="7.4"
          ry="2.6"
          transform="rotate(-28 50.6 26.2)"
          fill="none"
          stroke="#40e8f2"
          strokeOpacity="0.55"
          strokeWidth="0.9"
        />
        <circle cx="50.6" cy="26.2" r="3.7" fill={url(ids.orb)} />
        {/* copper joint bearings */}
        <circle cx="26" cy="41.5" r="5.2" fill="#f59e4b" />
        <circle cx="26" cy="41.5" r="1.9" fill="#0c1524" />
        <circle cx="19.5" cy="22.5" r="4.3" fill="#f59e4b" />
        <circle cx="19.5" cy="22.5" r="1.55" fill="#0c1524" />
        <circle cx="40.5" cy="14.5" r="3.4" fill="#f59e4b" />
        <circle cx="40.5" cy="14.5" r="1.2" fill="#0c1524" />
      </g>
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
