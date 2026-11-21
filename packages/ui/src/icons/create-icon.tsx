import { forwardRef, type ReactNode, type SVGProps } from "react";
import { cn } from "@robosim/ui/lib/utils";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "ref"> {
  /** Width and height in px (default 24). */
  size?: number | string;
  /** Stroke width on the 24 px grid (default 2, same as Lucide). */
  strokeWidth?: number | string;
  /** Accessible name. Without it the icon is decorative and hidden from screen readers. */
  title?: string;
}

/**
 * Builds an icon that matches Lucide exactly: 24 px grid, `currentColor` stroke, round caps and joins.
 * Our robotics/electronics icons therefore sit next to Lucide UI icons without looking different.
 */
export function createIcon(displayName: string, paths: ReactNode) {
  const Icon = forwardRef<SVGSVGElement, IconProps>(function Icon(
    { size = 24, strokeWidth = 2, title, className, ...props },
    ref,
  ) {
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        role={title ? "img" : undefined}
        aria-label={title}
        aria-hidden={title ? undefined : true}
        className={cn("rs-icon", className)}
        {...props}
      >
        {title ? <title>{title}</title> : null}
        {paths}
      </svg>
    );
  });
  Icon.displayName = displayName;
  return Icon;
}
