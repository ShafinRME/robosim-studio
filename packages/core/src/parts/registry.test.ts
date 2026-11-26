import { describe, expect, it } from "vitest";
import { checkCircuit } from "../circuit/issues";
import { createDevice } from "../circuit/component";
import { createDenseMna } from "../circuit/mna";
import { buildNetlist } from "../circuit/netlist";
import { connectivityOf } from "../schematic/connectivity";
import { createPart } from "../schematic/selection";
import { designatorPrefix, symbolFor } from "../schematic/symbols";
import { checkPart, definePart, type PartDefinition } from "./part";
import { COMPONENTS, PARTS, componentFor, partFor, requireComponent } from "./registry";

// Vitest (Vite) collects the part files itself, independent of the generated index.
declare global {
  interface ImportMeta {
    glob(pattern: string, options: { eager: true; import: "default" }): Record<string, unknown>;
  }
}
const FILES = import.meta.glob("./library/*.ts", { eager: true, import: "default" });

describe("part library (ADR 010)", () => {
  it("lists every part file in the generated index — run `pnpm parts` if this fails", () => {
    const fromFiles = Object.entries(FILES)
      .filter(([file]) => !file.endsWith("/index.ts"))
      .map(([, part]) => part);
    expect(fromFiles.length).toBe(PARTS.length);
    for (const part of fromFiles) expect(PARTS).toContain(part);
  });

  it("has valid parts with unique types", () => {
    for (const part of PARTS) expect(checkPart(part), part.type).toEqual([]);
    expect(new Set(PARTS.map((p) => p.type)).size).toBe(PARTS.length);
  });

  it("keeps the released part types (saved projects depend on them)", () => {
    for (const type of ["resistor", "source.dc-voltage", "source.dc-current", "ground"]) {
      expect(partFor(type), type).toBeDefined();
    }
    expect(componentFor("ground")).toBeUndefined();
    expect(COMPONENTS.map((c) => c.type)).toContain("resistor");
  });

  // "Adding a new part = 1 file": whatever is in the library works everywhere, with no other edit.
  it.each(PARTS.map((p) => [p.type, p] as const))(
    "%s works from symbol to simulator",
    (type, part) => {
      expect(symbolFor(type)).toBe(part.symbol);
      expect(designatorPrefix(type)).toBe(part.designatorPrefix);

      const placed = createPart(type, { x: 0, y: 0 }, [], { id: "p1" });
      expect(placed.name).toBe(`${part.designatorPrefix}1`);
      for (const property of part.component?.properties ?? []) {
        expect(placed.props[property.key]).toEqual(property.default);
      }

      const netlist = buildNetlist(
        connectivityOf({ parts: [placed], wires: [], labels: [] }).input,
      );
      expect(() => checkCircuit(netlist, componentFor)).not.toThrow();
      if (!part.component) return;
      const component = netlist.components.find((c) => c.id === "p1");
      expect(component?.pins.map((p) => p.id)).toEqual(part.component.pins.map((p) => p.id));
      const created = createDevice(part.component, component as never, 0, 0);
      expect(created.ok).toBe(true);
      if (!created.ok) return;
      const mna = createDenseMna(netlist.nets.length, part.component.branches);
      expect(() => created.device.stamp(mna.context)).not.toThrow();
    },
  );
});

describe("checkPart", () => {
  const resistor = requireComponent("resistor");
  const good = (): PartDefinition =>
    definePart({
      type: "test.part",
      name: "Test part",
      description: "A part for tests.",
      category: "passive",
      keywords: ["test"],
      designatorPrefix: "T",
      symbol: {
        bounds: { minX: -100, minY: -100, maxX: 100, maxY: 100 },
        pins: [
          { id: "1", x: -100, y: 0 },
          { id: "2", x: 100, y: 0 },
        ],
        body: {
          iec: [{ kind: "circle", cx: 0, cy: 0, r: 50 }],
          ansi: [{ kind: "circle", cx: 0, cy: 0, r: 50 }],
        },
        value: { key: "resistance", quantity: "resistance" },
      },
      model: { ...resistor, pins: resistor.pins },
    });

  it("joins the pieces: symbol and model carry the part's type and catalogue fields", () => {
    const part = good();
    expect(part.symbol.type).toBe("test.part");
    expect(part.component).toMatchObject({ type: "test.part", designatorPrefix: "T" });
  });

  it("finds the mistakes a part file can make", () => {
    const base = good();
    const broken: PartDefinition = {
      ...base,
      designatorPrefix: "t1",
      keywords: ["Upper"],
      symbol: {
        ...base.symbol,
        pins: [
          { id: "1", x: -150, y: 0 },
          { id: "3", x: 300, y: 0 },
        ],
        body: { iec: [], ansi: [] },
        value: { key: "resistance", quantity: "voltage" },
      },
    };
    const problems = checkPart(broken).join("\n");
    expect(problems).toMatch(/designator prefix/);
    expect(problems).toMatch(/keyword "Upper"/);
    expect(problems).toMatch(/not on the 100-mil grid/);
    expect(problems).toMatch(/outside the symbol bounds/);
    expect(problems).toMatch(/both styles/);
    expect(problems).toMatch(/symbol pins/);
    expect(problems).toMatch(/value label/);
  });

  it("requires a model unless the part has a role", () => {
    const { component: _omit, ...noModel } = good();
    expect(checkPart(noModel).join()).toMatch(/needs an electrical model/);
    expect(
      checkPart({ ...noModel, symbol: { ...noModel.symbol, value: undefined }, role: "ground" }),
    ).toEqual([]);
  });
});
