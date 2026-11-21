import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LogoMark } from "@robosim/ui/components/logo";
import { ROBOTICS_ICONS } from "./robotics";

describe("robotics icons", () => {
  const entries = Object.entries(ROBOTICS_ICONS);

  it("has 12 icons", () => {
    expect(entries).toHaveLength(12);
  });

  it.each(entries)("%s renders on the 24 px Lucide grid with currentColor", (_name, Icon) => {
    const svg = renderToStaticMarkup(<Icon />);
    expect(svg).toContain('viewBox="0 0 24 24"');
    expect(svg).toContain('stroke="currentColor"');
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).not.toContain("<title>");
  });

  it("becomes an accessible image when it has a title", () => {
    const svg = renderToStaticMarkup(<ROBOTICS_ICONS.Resistor title="Resistor" size={16} />);
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-label="Resistor"');
    expect(svg).toContain("<title>Resistor</title>");
    expect(svg).toContain('width="16"');
  });
});

describe("LogoMark", () => {
  it("is labelled by default", () => {
    const svg = renderToStaticMarkup(<LogoMark />);
    expect(svg).toContain('aria-label="RoboSim Studio"');
  });

  it("is hidden when decorative", () => {
    const svg = renderToStaticMarkup(<LogoMark title="" />);
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).not.toContain("role=");
  });

  it("uses unique gradient ids so several logos can share a page", () => {
    const a = renderToStaticMarkup(<LogoMark />);
    const ids = [...a.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
