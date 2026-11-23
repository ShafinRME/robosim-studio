/**
 * What this computer can do, and whether the studio should start in Low-end mode (Day 10).
 *
 * The browser gives hints (memory, CPU cores, WebGL2 support, graphics renderer name). They stay on
 * this computer: they only decide settings here and are never sent anywhere. Pure logic, so it is
 * unit-tested; the web app gathers the hints.
 */

/** At or below these, the studio recommends Low-end mode. */
export const LOW_END_MAX_MEMORY_GB = 4;
export const LOW_END_MAX_CORES = 2;

export type CapabilityHints = {
  /** `navigator.deviceMemory` in GB (Chromium only; rounded down by the browser, max 8). */
  deviceMemory?: number;
  hardwareConcurrency?: number;
  /** Whether a WebGL2 context could be created (undefined: not checked). */
  webgl2?: boolean;
  /** The WebGL renderer name, e.g. "ANGLE (Intel, Intel(R) UHD Graphics 620 …)". */
  renderer?: string;
};

export type LowEndReason = "memory" | "cores" | "no-webgl2" | "software-graphics";

export type CapabilityReport = {
  memoryGb: number | null;
  cores: number | null;
  webgl2: boolean | null;
  renderer: string | null;
  /** Graphics are drawn by the CPU (no usable GPU / driver): 3D will be slow. */
  softwareGraphics: boolean;
  lowEndReasons: LowEndReason[];
  lowEndRecommended: boolean;
};

// Known CPU (software) renderers: Chrome's SwiftShader, Mesa llvmpipe/softpipe, Windows' fallback.
const SOFTWARE_RENDERER =
  /swiftshader|llvmpipe|softpipe|software rasterizer|microsoft basic render|mesa offscreen/i;

export function isSoftwareRenderer(renderer: string | undefined | null): boolean {
  return typeof renderer === "string" && SOFTWARE_RENDERER.test(renderer.slice(0, 300));
}

const positive = (value: number | undefined): number | null =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;

export function assessCapabilities(hints: CapabilityHints): CapabilityReport {
  const memoryGb = positive(hints.deviceMemory);
  const cores = positive(hints.hardwareConcurrency);
  const webgl2 = typeof hints.webgl2 === "boolean" ? hints.webgl2 : null;
  const renderer =
    typeof hints.renderer === "string" && hints.renderer.trim()
      ? hints.renderer.trim().slice(0, 200)
      : null;
  const softwareGraphics = isSoftwareRenderer(renderer);

  const reasons: LowEndReason[] = [];
  if (memoryGb !== null && memoryGb <= LOW_END_MAX_MEMORY_GB) reasons.push("memory");
  if (cores !== null && cores <= LOW_END_MAX_CORES) reasons.push("cores");
  if (webgl2 === false) reasons.push("no-webgl2");
  if (softwareGraphics) reasons.push("software-graphics");

  return {
    memoryGb,
    cores,
    webgl2,
    renderer,
    softwareGraphics,
    lowEndReasons: reasons,
    lowEndRecommended: reasons.length > 0,
  };
}

/** Plain-language reason, for the status bar and the system information window. */
export function describeLowEndReason(reason: LowEndReason, report: CapabilityReport): string {
  switch (reason) {
    case "memory":
      return `${report.memoryGb} GB of memory or less`;
    case "cores":
      return `${report.cores} processor cores`;
    case "no-webgl2":
      return "no WebGL2 graphics";
    case "software-graphics":
      return "graphics drawn without a graphics card";
  }
}

/**
 * How the studio behaves in normal and Low-end mode. Every heavy feature reads its settings from
 * here, so Low-end mode is one switch for the whole studio.
 */
export type PerformanceProfile = {
  animations: boolean;
  /** Text readouts (simulation time, live values) update at most this often (ms). */
  readoutMs: number;
  /** The simulation worker sends snapshots this often (ms). */
  snapshotMs: number;
  /** 3D views render at most at this device-pixel ratio. */
  maxPixelRatio: number;
  antialias: boolean;
  shadows: boolean;
};

export function performanceProfile(lowEnd: boolean): PerformanceProfile {
  return lowEnd
    ? {
        animations: false,
        readoutMs: 250,
        snapshotMs: 66,
        maxPixelRatio: 1,
        antialias: false,
        shadows: false,
      }
    : {
        animations: true,
        readoutMs: 100,
        snapshotMs: 33,
        maxPixelRatio: 2,
        antialias: true,
        shadows: true,
      };
}
