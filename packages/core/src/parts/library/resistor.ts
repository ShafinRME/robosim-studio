/** Resistor (ADR 010 part file). Current is positive from pin 1 to pin 2. */
import { numberProp } from "../../circuit/component";
import { ZIGZAG, line } from "../draw";
import { definePart } from "../part";

export default definePart({
  type: "resistor",
  name: "Resistor",
  description: "Limits current. Ohm's law: V = I × R.",
  category: "passive",
  keywords: ["res", "ohm", "resistance", "load"],
  designatorPrefix: "R",
  // Horizontal: pin 1 left, pin 2 right, 400 mil long.
  symbol: {
    bounds: { minX: -200, minY: -40, maxX: 200, maxY: 40 },
    pins: [
      { id: "1", x: -200, y: 0 },
      { id: "2", x: 200, y: 0 },
    ],
    body: {
      iec: [
        line(-200, 0, -100, 0),
        { kind: "rect", x: -100, y: -40, width: 200, height: 80 },
        line(100, 0, 200, 0),
      ],
      ansi: [line(-200, 0, -100, 0), { kind: "polyline", points: ZIGZAG }, line(100, 0, 200, 0)],
    },
    labels: { designator: { x: 0, y: -90 }, value: { x: 0, y: 90 } },
    value: { key: "resistance", quantity: "resistance" },
  },
  model: {
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
    dcPaths: [[0, 1]],
    create({ props, nodes: [a = 0, b = 0] }) {
      const g = 1 / numberProp(props, "resistance");
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
  },
});
