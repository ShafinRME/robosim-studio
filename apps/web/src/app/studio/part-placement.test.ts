import { describe, expect, it } from "vitest";
import { decodePartDrag, encodePartDrag } from "./part-placement";

describe("part drag data (untrusted: it can come from any page)", () => {
  it("round-trips a drawer drag", () => {
    const request = { type: "resistor", props: { resistance: 10_000 } };
    expect(decodePartDrag(encodePartDrag(request))).toEqual(request);
  });

  it("refuses junk, unknown parts and oversized data", () => {
    expect(decodePartDrag("")).toBeNull();
    expect(decodePartDrag("not json")).toBeNull();
    expect(decodePartDrag("[]")).toBeNull();
    expect(decodePartDrag(JSON.stringify({ type: "rocket" }))).toBeNull();
    expect(decodePartDrag(JSON.stringify({ type: 7 }))).toBeNull();
    expect(decodePartDrag(JSON.stringify({ type: "resistor", pad: "x".repeat(3_000) }))).toBeNull();
  });

  it("keeps only known properties with valid values", () => {
    expect(
      decodePartDrag(
        JSON.stringify({
          type: "resistor",
          props: { resistance: 220, __proto__x: 1, colour: "red" },
        }),
      ),
    ).toEqual({ type: "resistor", props: { resistance: 220 } });
    // An impossible value is dropped: the part gets its defaults instead.
    expect(decodePartDrag(JSON.stringify({ type: "resistor", props: { resistance: -5 } }))).toEqual(
      {
        type: "resistor",
      },
    );
    expect(
      decodePartDrag(JSON.stringify({ type: "resistor", props: { resistance: { $gt: 1 } } })),
    ).toEqual({ type: "resistor" });
  });
});
