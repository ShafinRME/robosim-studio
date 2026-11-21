import path from "node:path";
import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Content Security Policy.
 * - Everything is served from our own origin; fonts are self-hosted by next/font.
 * - `script-src 'unsafe-inline'` is still needed for Next.js' inline bootstrap scripts on static pages.
 *   Moving to nonce/hash-based scripts is tracked for Day 173 (security hardening) in docs/STATUS.md.
 * - `'unsafe-eval'` only in development (React Refresh / Turbopack); never in production.
 * - `wasm-unsafe-eval` is allowed for the WebAssembly simulators (SPICE, MicroPython, ESP32 core).
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "worker-src 'self' blob:",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  {
    // Deny powerful browser features until a lab needs them (camera: Gesture Control Lab, Day 147;
    // serial: real-robot bridge, Day 152). Each one is enabled deliberately, with a review.
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), serial=(), usb=(), bluetooth=(), payment=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Hide the floating "N" dev badge so dev screenshots (User Manual) look like the real app.
  // Build errors still appear in the dev overlay.
  devIndicators: false,
  // Workspace packages ship TypeScript source; Next.js compiles them.
  transpilePackages: ["@robosim/core", "@robosim/ui"],
  turbopack: {
    // Monorepo root, so Turbopack can resolve workspace packages and the hoisted `next`.
    root: path.join(__dirname, "../.."),
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
