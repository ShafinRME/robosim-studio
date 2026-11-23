/**
 * Gathers the browser's hints about this computer (Day 10), once per page: memory, CPU cores,
 * WebGL2 support and the graphics renderer name. The hints stay on this computer — they only choose
 * settings here and are never sent anywhere. The decision logic is `assessCapabilities` in core.
 */
import { assessCapabilities, type CapabilityHints, type CapabilityReport } from "@robosim/core";

let cached: CapabilityHints | null = null;

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

/** The hints for this computer (empty on the server). Measured once, then reused. */
export function readCapabilityHints(): CapabilityHints {
  if (typeof window === "undefined") return {};
  if (cached) return cached;
  const nav = navigator as Navigator & { deviceMemory?: number };
  cached = {
    deviceMemory: nav.deviceMemory,
    hardwareConcurrency: nav.hardwareConcurrency,
    ...probeWebGL(),
  };
  return cached;
}

export function readCapabilities(): CapabilityReport {
  return assessCapabilities(readCapabilityHints());
}
