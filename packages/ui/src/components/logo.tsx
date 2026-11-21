import { useId, type SVGProps } from "react";
import { cn } from "@robosim/ui/lib/utils";

/**
 * RoboSim Studio logo — "Signal arm".
 * A two-link robot arm drawn like a signal trace on a teal-to-blue tile: grounded base, hollow
 * elbow joint, copper end-effector emitting a signal. Original artwork (ADR 002).
 */
export function LogoMark({
  title = "RoboSim Studio",
  className,
  ...props
}: SVGProps<SVGSVGElement> & { title?: string }) {
  const id = useId();
  const decorative = title === "";
  const tile = `${id}-tile`;
  const sheen = `${id}-sheen`;
  return (
    <svg
      viewBox="0 0 32 32"
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : title}
      aria-hidden={decorative ? true : undefined}
      className={cn("size-8 shrink-0", className)}
      {...props}
    >
      {decorative ? null : <title>{title}</title>}
      <defs>
        <linearGradient id={tile} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22c7d6" />
          <stop offset="1" stopColor="#1d4fd8" />
        </linearGradient>
        <linearGradient id={sheen} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="8" fill={`url(#${tile})`} />
      <rect x="1" y="1" width="30" height="30" rx="8" fill={`url(#${sheen})`} />
      <g fill="none" stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round">
        {/* ground + links */}
        <path d="M5.5 25.5h8" strokeWidth="2" opacity="0.7" />
        <path d="M9.5 23 13.5 11.5 22 15" strokeWidth="2.4" />
        {/* signal emitted by the end-effector */}
        <path d="M25.2 10.6a6 6 0 0 1 0 8.8" strokeWidth="1.6" opacity="0.85" />
        <path d="M27.6 8.4a9.4 9.4 0 0 1 0 13.2" strokeWidth="1.4" opacity="0.45" />
      </g>
      {/* joints: solid base, hollow elbow, copper end-effector */}
      <circle cx="9.5" cy="23" r="2.6" fill="#ffffff" />
      <circle cx="13.5" cy="11.5" r="2.5" fill="#1b5fd0" stroke="#ffffff" strokeWidth="1.8" />
      <circle cx="22" cy="15" r="2.7" fill="#f2a65a" stroke="#ffffff" strokeWidth="1.2" />
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
