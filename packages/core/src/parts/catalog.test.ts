import { describe, expect, it } from "vitest";
import { groupParts, searchParts } from "./catalog";
import { PARTS } from "./registry";

const types = (query: string) => searchParts(query).map((m) => m.part.type);

describe("parts catalogue", () => {
  it("groups every part once, sources first", () => {
    const groups = groupParts();
    expect(groups[0]?.label).toBe("Sources");
    expect(groups.flatMap((g) => g.parts)).toHaveLength(PARTS.length);
  });

  it("lists everything for an empty search", () => {
    expect(searchParts("  ")).toHaveLength(PARTS.length);
  });

  it("finds parts by name, prefix, keyword, designator and category", () => {
    expect(types("res")[0]).toBe("resistor");
    expect(types("pot")[0]).toBe("resistor.potentiometer");
    expect(types("battery")[0]).toBe("source.dc-voltage");
    expect(types("gnd")[0]).toBe("ground");
    expect(types("sw")[0]).toBe("switch.spst");
    expect(types("toggle")).toEqual(["switch.spst"]);
    expect(types("passives")).toEqual(
      expect.arrayContaining(["resistor", "resistor.potentiometer"]),
    );
  });

  it("needs every word to match", () => {
    expect(types("dc current")).toEqual(["source.dc-current"]);
    expect(types("resistor banana")).toEqual([]);
  });

  it("understands values: 10k → resistor (and pot) with 10 kΩ ready", () => {
    const [first] = searchParts("10k");
    expect(first?.part.type).toBe("resistor");
    expect(first?.preset).toEqual({ key: "resistance", value: 10_000, text: "10k" });
    expect(types("4k7")).toContain("resistor.potentiometer");
    expect(searchParts("9v")[0]).toMatchObject({
      part: { type: "source.dc-voltage" },
      preset: { key: "voltage", value: 9 },
    });
    expect(searchParts("resistor 220")[0]?.preset).toBeUndefined();
    expect(types("2mA")).toEqual(["source.dc-current"]);
  });

  it("ignores values a part cannot take", () => {
    expect(types("0r")).not.toContain("resistor");
  });
});
