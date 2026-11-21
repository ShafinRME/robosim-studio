import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import type { ReactNode } from "react";
import "@robosim/ui/globals.css";

// Self-hosted at build time by next/font: no requests to Google at runtime.
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "RoboSim Studio",
  description: "A free, open-source robotics lab that runs in your browser.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    // Dark is the studio default; the theme switcher arrives in Day 05 · Step 2.
    <html lang="en" className={`dark ${plexSans.variable} ${plexMono.variable}`}>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
