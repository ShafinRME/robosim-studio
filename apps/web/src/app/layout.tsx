import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@robosim/ui/globals.css";

export const metadata: Metadata = {
  title: "RoboSim Studio",
  description: "A free, open-source robotics lab that runs in your browser.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
