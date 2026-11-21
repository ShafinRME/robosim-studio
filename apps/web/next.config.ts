import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Hide the floating "N" dev badge so dev screenshots (User Manual) look like the real app.
  // Build errors still appear in the dev overlay.
  devIndicators: false,
  // Workspace packages ship TypeScript source; Next.js compiles them.
  transpilePackages: ["@robosim/core", "@robosim/ui"],
  turbopack: {
    // Monorepo root, so Turbopack can resolve workspace packages and the hoisted `next`.
    root: path.join(__dirname, "../.."),
  },
};

export default nextConfig;
