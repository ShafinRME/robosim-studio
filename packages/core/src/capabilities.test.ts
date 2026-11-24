import { describe, expect, it } from "vitest";
import {
  assessCapabilities,
  describeLowEndReason,
  isMaskedRenderer,
  isSoftwareRenderer,
  performanceProfile,
  type CapabilityHints,
} from "./capabilities";

const INTEL =
  "ANGLE (Intel, Intel(R) UHD Graphics 620 (0x00005917) Direct3D11 vs_5_0 ps_5_0, D3D11)";
const SWIFTSHADER =
  "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)";

describe("isSoftwareRenderer", () => {
  it.each([
    [SWIFTSHADER, true],
    ["llvmpipe (LLVM 15.0.7, 256 bits)", true],
    ["Mesa softpipe", true],
    ["ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11)", true],
    [INTEL, false],
    ["ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11)", false],
    ["Apple M1", false],
    ["", false],
    [null, false],
  ])("%s → %s", (renderer, expected) => {
    expect(isSoftwareRenderer(renderer)).toBe(expected);
  });
});

describe("isMaskedRenderer", () => {
  it.each([
    ["Brave", true],
    ["WebKit WebGL", true],
    ["Apple GPU", true],
    ["Mozilla", true],
    [INTEL, false],
    [SWIFTSHADER, false],
    [null, false],
  ])("%s → %s", (renderer, expected) => {
    expect(isMaskedRenderer(renderer)).toBe(expected);
  });

  it("does not guess from a hidden name: no software-graphics verdict", () => {
    const report = assessCapabilities({ webgl2: true, renderer: "Brave" });
    expect(report).toMatchObject({ rendererHidden: true, softwareGraphics: false });
    expect(report.lowEndRecommended).toBe(false);
  });
});

describe("assessCapabilities", () => {
  it("a typical 8 GB laptop with integrated graphics needs no Low-end mode", () => {
    expect(
      assessCapabilities({
        deviceMemory: 8,
        hardwareConcurrency: 8,
        webgl2: true,
        renderer: INTEL,
      }),
    ).toEqual({
      memoryGb: 8,
      cores: 8,
      webgl2: true,
      renderer: INTEL,
      rendererHidden: false,
      softwareGraphics: false,
      lowEndReasons: [],
      lowEndRecommended: false,
    });
  });

  it.each<[string, CapabilityHints, string[]]>([
    ["4 GB of memory", { deviceMemory: 4 }, ["memory"]],
    ["2 cores", { hardwareConcurrency: 2 }, ["cores"]],
    ["no WebGL2", { webgl2: false }, ["no-webgl2"]],
    ["software graphics", { webgl2: true, renderer: SWIFTSHADER }, ["software-graphics"]],
    [
      "several problems",
      { deviceMemory: 2, hardwareConcurrency: 2, webgl2: false },
      ["memory", "cores", "no-webgl2"],
    ],
  ])("recommends Low-end mode for %s", (_name, hints, reasons) => {
    const report = assessCapabilities(hints);
    expect(report.lowEndReasons).toEqual(reasons);
    expect(report.lowEndRecommended).toBe(true);
  });

  it("treats missing or nonsense hints as unknown, not as weak", () => {
    const report = assessCapabilities({
      deviceMemory: Number.NaN,
      hardwareConcurrency: -1,
      renderer: "   ",
    });
    expect(report).toMatchObject({
      memoryGb: null,
      cores: null,
      webgl2: null,
      renderer: null,
      lowEndRecommended: false,
    });
    expect(assessCapabilities({}).lowEndRecommended).toBe(false);
  });

  it("caps a very long renderer name", () => {
    expect(assessCapabilities({ renderer: "x".repeat(5000) }).renderer).toHaveLength(200);
  });
});

describe("describeLowEndReason", () => {
  it("explains each reason in plain words", () => {
    const report = assessCapabilities({
      deviceMemory: 2,
      hardwareConcurrency: 2,
      webgl2: false,
      renderer: SWIFTSHADER,
    });
    expect(report.lowEndReasons.map((r) => describeLowEndReason(r, report))).toEqual([
      "2 GB of memory or less",
      "2 processor cores",
      "no WebGL2 graphics",
      "graphics drawn without a graphics card",
    ]);
  });
});

describe("performanceProfile", () => {
  it("is lighter in every way in Low-end mode", () => {
    const normal = performanceProfile(false);
    const low = performanceProfile(true);
    expect(normal.animations && !low.animations).toBe(true);
    expect(low.readoutMs).toBeGreaterThan(normal.readoutMs);
    expect(low.snapshotMs).toBeGreaterThan(normal.snapshotMs);
    expect(low.maxPixelRatio).toBeLessThan(normal.maxPixelRatio);
    expect(low.antialias || low.shadows).toBe(false);
  });
});
