import type { Metadata } from "next";
import { StudioShell } from "./studio-shell";

export const metadata: Metadata = {
  title: "Studio · RoboSim Studio",
};

export default function StudioPage() {
  return <StudioShell />;
}
