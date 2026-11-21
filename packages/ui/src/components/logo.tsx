import { useId, type SVGProps } from "react";
import { cn } from "@robosim/ui/lib/utils";

/**
 * RoboSim Studio logo — "R-Arm" monogram.
 * The letter R drawn as an articulated robot arm: the stem is the base column standing on a plate,
 * the bowl is the shoulder link, the leg is the forearm, and a copper end-effector closes the stroke.
 * Punched "pin" holes mark the joints. One stroke weight, round terminals, on a deep ink tile with a
 * teal→blue signal gradient. Original artwork (ADR 002). Static copy: apps/web/src/app/icon.svg.
 */
export function LogoMark({
  title = "RoboSim Studio",
  className,
  ...props
}: SVGProps<SVGSVGElement> & { title?: string }) {
  const id = useId();
  const decorative = title === "";
  const tile = `${id}-tile`;
  const signal = `${id}-signal`;
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
        <linearGradient id={tile} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#14223a" />
          <stop offset="1" stopColor="#0a111d" />
        </linearGradient>
        <linearGradient id={signal} x1="9" y1="7" x2="24" y2="25" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3ee6f0" />
          <stop offset="1" stopColor="#3b7bff" />
        </linearGradient>
      </defs>
      {/* tile with a hairline edge */}
      <rect x="1" y="1" width="30" height="30" rx="8" fill={`url(#${tile})`} />
      <rect
        x="1.3"
        y="1.3"
        width="29.4"
        height="29.4"
        rx="7.7"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.14"
        strokeWidth="0.6"
      />
      {/* R-Arm: base plate, base column, shoulder link (bowl), forearm */}
      <g
        fill="none"
        stroke={`url(#${signal})`}
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 24.5h7M11.5 24.5V8.25h4.75a4.625 4.625 0 0 1 0 9.25H11.5M16 17.5l5.4 5.1" />
      </g>
      {/* joint pins punched through the links */}
      <circle cx="11.5" cy="8.25" r="1.05" fill="#0e1828" />
      <circle cx="16" cy="17.5" r="1.05" fill="#0e1828" />
      {/* copper end-effector */}
      <circle cx="22.9" cy="24" r="2.45" fill="#f59e4b" />
      <circle cx="22.9" cy="24" r="0.9" fill="#0e1828" />
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
