/**
 * Ideal DC voltage source (ADR 010 part file): V(+) − V(−) = voltage. SPICE convention: its current
 * flows from + through the source to −, so a source delivering power has a negative current and
 * negative absorbed power.
 */
import { numberProp } from "../../circuit/component";
import { line, minus, plus } from "../draw";
import { definePart } from "../part";

export default definePart({
  type: "source.dc-voltage",
  name: "DC voltage source",
  description: "Keeps a fixed voltage between + and −, like an ideal battery or bench supply.",
  category: "source",
  keywords: ["battery", "supply", "vcc", "volt", "dc", "cell"],
  designatorPrefix: "V",
  // Vertical: "+" on top.
  symbol: {
    bounds: { minX: -100, minY: -200, maxX: 100, maxY: 200 },
    pins: [
      { id: "+", x: 0, y: -200 },
      { id: "-", x: 0, y: 200 },
    ],
    body: {
      // IEC 60617: circle with the conductor drawn through it, polarity mark outside.
      iec: [line(0, -200, 0, 200), { kind: "circle", cx: 0, cy: 0, r: 100 }, ...plus(55, -150, 18)],
      // ANSI: circle with + and − inside.
      ansi: [
        line(0, -200, 0, -100),
        { kind: "circle", cx: 0, cy: 0, r: 100 },
        line(0, 100, 0, 200),
        ...plus(0, -42),
        ...minus(0, 45),
      ],
    },
    labels: { designator: { x: 150, y: -40 }, value: { x: 150, y: 40 } },
    value: { key: "voltage", quantity: "voltage" },
  },
  model: {
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
    dcPaths: [[0, 1]],
    voltagePairs: [[0, 1]],
    create({ props, nodes: [p = 0, n = 0], branches: [k = 0] }) {
      const voltage = numberProp(props, "voltage");
      return {
        stamp(ctx) {
          ctx.voltageSource(k, p, n, voltage);
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
  },
});
