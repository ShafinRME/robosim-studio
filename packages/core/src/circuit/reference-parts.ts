/**
 * Reference parts (Day 11): the three linear DC elements every MNA solver starts from. They pin
 * down the component interface and its sign conventions in tests; on Day 14 they move into the
 * parts registry (one file per part, with symbol artwork) unchanged.
 */
import { numberProp, type ComponentDefinition } from "./component";

/** Resistor: conductance 1/R between pins 1 and 2. Current is positive from pin 1 to pin 2. */
export const resistorDefinition: ComponentDefinition = {
  type: "resistor",
  name: "Resistor",
  category: "passive",
  designatorPrefix: "R",
  pins: [
    { id: "1", name: "Pin 1", type: "passive" },
    { id: "2", name: "Pin 2", type: "passive" },
  ],
  properties: [
    {
      kind: "number",
      key: "resistance",
      label: "Resistance",
      quantity: "resistance",
      default: 1_000,
      min: 0,
      exclusiveMin: true,
      max: 1e12,
    },
    {
      kind: "number",
      key: "tolerance",
      label: "Tolerance",
      quantity: "percent",
      default: 0.05,
      min: 0,
      max: 0.5,
    },
    {
      kind: "number",
      key: "powerRating",
      label: "Power rating",
      quantity: "power",
      default: 0.25,
      min: 0,
      exclusiveMin: true,
      max: 1_000,
    },
  ],
  branches: 0,
  stateSize: 0,
  create({ props, nodes: [a = 0, b = 0] }) {
    const resistance = numberProp(props, "resistance");
    const g = 1 / resistance;
    return {
      stamp(ctx) {
        ctx.conductance(a, b, g);
      },
      report(solution) {
        const voltage = solution.voltage(a) - solution.voltage(b);
        const current = voltage * g;
        return [
          { key: "voltage", label: "Voltage", quantity: "voltage", value: voltage },
          { key: "current", label: "Current", quantity: "current", value: current },
          { key: "power", label: "Power", quantity: "power", value: voltage * current },
        ];
      },
    };
  },
};

/**
 * Ideal DC voltage source: V(+) − V(−) = voltage. SPICE convention: its current flows from + through
 * the source to −, so a source delivering power has a negative current and negative absorbed power.
 */
export const dcVoltageSourceDefinition: ComponentDefinition = {
  type: "source.dc-voltage",
  name: "DC voltage source",
  category: "source",
  designatorPrefix: "V",
  pins: [
    { id: "+", name: "Positive (+)", type: "power-out" },
    { id: "-", name: "Negative (−)", type: "power-out" },
  ],
  properties: [
    {
      kind: "number",
      key: "voltage",
      label: "Voltage",
      quantity: "voltage",
      default: 5,
      min: -1e6,
      max: 1e6,
    },
  ],
  branches: 1,
  stateSize: 0,
  create({ props, nodes: [plus = 0, minus = 0], branches: [k = 0] }) {
    const voltage = numberProp(props, "voltage");
    return {
      stamp(ctx) {
        ctx.voltageSource(k, plus, minus, voltage);
      },
      report(solution) {
        const current = solution.branchCurrent(k);
        return [
          { key: "voltage", label: "Voltage", quantity: "voltage", value: voltage },
          { key: "current", label: "Current", quantity: "current", value: current },
          { key: "power", label: "Power absorbed", quantity: "power", value: voltage * current },
        ];
      },
    };
  },
};

/** Ideal DC current source: `current` flows in at pin "in", through the source, out at "out" (the arrow). */
export const dcCurrentSourceDefinition: ComponentDefinition = {
  type: "source.dc-current",
  name: "DC current source",
  category: "source",
  designatorPrefix: "I",
  pins: [
    { id: "in", name: "In (tail of arrow)", type: "power-out" },
    { id: "out", name: "Out (arrow head)", type: "power-out" },
  ],
  properties: [
    {
      kind: "number",
      key: "current",
      label: "Current",
      quantity: "current",
      default: 0.001,
      min: -1e3,
      max: 1e3,
    },
  ],
  branches: 0,
  stateSize: 0,
  create({ props, nodes: [from = 0, to = 0] }) {
    const current = numberProp(props, "current");
    return {
      stamp(ctx) {
        ctx.current(from, to, current);
      },
      report(solution) {
        const voltage = solution.voltage(from) - solution.voltage(to);
        return [
          { key: "voltage", label: "Voltage", quantity: "voltage", value: voltage },
          { key: "current", label: "Current", quantity: "current", value: current },
          { key: "power", label: "Power absorbed", quantity: "power", value: voltage * current },
        ];
      },
    };
  },
};

export const REFERENCE_PARTS: readonly ComponentDefinition[] = [
  resistorDefinition,
  dcVoltageSourceDefinition,
  dcCurrentSourceDefinition,
];
