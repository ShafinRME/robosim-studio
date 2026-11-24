import { describe, expect, it } from "vitest";
import { APP_VERSION, LABS } from "./index";

describe("LABS", () => {
  it("lists exactly the 10 labs from ADR 001", () => {
    expect(LABS).toHaveLength(10);
  });

  it("has unique, kebab-case ids", () => {
    const ids = LABS.map((lab) => lab.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("is ordered by plan phase (P1–P9)", () => {
    const phases = LABS.map((lab) => lab.phase);
    expect(phases).toEqual([...phases].sort((a, b) => a - b));
    expect(Math.min(...phases)).toBe(1);
    expect(Math.max(...phases)).toBe(9);
  });

  it("ships Control Systems and Power Electronics as separate labs in the same phase", () => {
    const control = LABS.find((lab) => lab.id === "control");
    const power = LABS.find((lab) => lab.id === "power");
    expect(control?.phase).toBe(6);
    expect(power?.phase).toBe(6);
  });
});

describe("APP_VERSION", () => {
  it("is a semantic version", () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
