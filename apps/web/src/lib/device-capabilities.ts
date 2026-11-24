/**
 * Gathers the browser's hints about this computer (Day 10): memory, CPU cores, WebGL2 support and
 * the graphics renderer name. The hints stay on this computer — they only choose settings here and
 * are never sent anywhere. The decision logic is `assessCapabilities` in core.
 *
 * Memory and cores are free to read. The graphics check creates a WebGL context, which blocks the
 * page for a moment, so it runs once the page is idle (Lighthouse, Day 10); listeners hear when the
 * hints change.
 */
import { assessCapabilities, type CapabilityHints, type CapabilityReport } from "@robosim/core";

let hints: CapabilityHints | null = null;
let graphicsChecked = false;
const listeners = new Set<() => void>();

function probeWebGL(): Pick<CapabilityHints, "webgl2" | "renderer"> {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    if (!gl) return { webgl2: false };
    // Modern browsers expose the real renderer name as RENDERER; older ones need the extension.
    const debug = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = String(
      gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? "",
    );
    // Free the GPU context at once: browsers allow only a few at a time.
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return { webgl2: true, renderer };
  } catch {
    return {};
  }
}

function checkGraphicsWhenIdle() {
  if (graphicsChecked) return;
  graphicsChecked = true;
  const run = () => {
    hints = { ...hints, ...probeWebGL() };
    for (const listener of listeners) listener();
  };
  if ("requestIdleCallback" in window) window.requestIdleCallback(run, { timeout: 2000 });
  else setTimeout(run, 200);
}

/**
 * The hints for this computer (empty on the server). The same object is returned until the hints
 * change, so it can be used as a `useSyncExternalStore` snapshot.
 */
export function readCapabilityHints(): CapabilityHints {
  if (typeof window === "undefined") return {};
  if (!hints) {
    const nav = navigator as Navigator & { deviceMemory?: number };
    hints = { deviceMemory: nav.deviceMemory, hardwareConcurrency: nav.hardwareConcurrency };
    checkGraphicsWhenIdle();
  }
  return hints;
}

/** Called when the graphics check finishes (the hints may now recommend Low-end mode). */
export function subscribeCapabilities(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** Measures the graphics now if the idle check has not run yet (System information window). */
export function readCapabilities(): CapabilityReport {
  const current = readCapabilityHints();
  if (current.webgl2 === undefined && typeof window !== "undefined") {
    hints = { ...current, ...probeWebGL() };
    for (const listener of listeners) listener();
  }
  return assessCapabilities(readCapabilityHints());
}
