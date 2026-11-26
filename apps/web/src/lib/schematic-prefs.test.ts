import { describe, expect, it } from "vitest";
import { DEFAULT_SCHEMATIC_PREFS, parseSchematicPrefs } from "./schematic-prefs";

describe("parseSchematicPrefs", () => {
  it("reads stored choices", () => {
    expect(parseSchematicPrefs('{"symbolStyle":"ansi","lengthUnit":"in"}')).toEqual({
      symbolStyle: "ansi",
      lengthUnit: "in",
      showDcResults: true,
    });
    expect(parseSchematicPrefs('{"showDcResults":false}').showDcResults).toBe(false);
    expect(parseSchematicPrefs('{"showDcResults":"no"}').showDcResults).toBe(true);
  });

  it("falls back per field for anything unexpected", () => {
    expect(parseSchematicPrefs('{"symbolStyle":"din","lengthUnit":"in"}')).toEqual({
      symbolStyle: "iec",
      lengthUnit: "in",
      showDcResults: true,
    });
    for (const text of [null, "", "{broken", "[]", "42", '"ansi"', "x".repeat(500)]) {
      expect(parseSchematicPrefs(text)).toEqual(DEFAULT_SCHEMATIC_PREFS);
    }
  });

  it("never picks up inherited keys", () => {
    expect(parseSchematicPrefs('{"__proto__":{"symbolStyle":"ansi"}}')).toEqual(
      DEFAULT_SCHEMATIC_PREFS,
    );
  });
});
