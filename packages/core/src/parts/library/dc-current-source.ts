/**
 * Ideal DC current source (ADR 010 part file): `current` flows in at pin "in", through the source,
 * out at "out" (the arrow).
 */
import { numberProp } from "../../circuit/component";
import { line } from "../draw";
import { definePart } from "../part";

export default definePart({
  type: "source.dc-current",
  name: "DC current source",
  description: "Pushes a fixed current through the circuit, whatever the voltage across it.",
  category: "source",
  keywords: ["current", "amp", "dc", "constant current"],
  designatorPrefix: "I",
  // Vertical: current flows in at the bottom and out at the top (arrow up).
  symbol: {
    // Wider on the right for the IEC direction arrow.
    bounds: { minX: -100, minY: -200, maxX: 170, maxY: 200 },
    pins: [
      { id: "in", x: 0, y: 200 },
      { id: "out", x: 0, y: -200 },
    ],
    body: {
      // IEC 60617: circle with a bar across the conductor; direction arrow beside it.
      iec: [
        line(0, -200, 0, -100),
        { kind: "circle", cx: 0, cy: 0, r: 100 },
        line(-100, 0, 100, 0),
        line(0, 100, 0, 200),
        line(150, 60, 150, -40),
        {
          kind: "polygon",
          points: [
            [150, -75],
            [132, -35],
            [168, -35],
          ],
        },
      ],
      // ANSI: circle with an arrow inside.
      ansi: [
        line(0, -200, 0, -100),
        { kind: "circle", cx: 0, cy: 0, r: 100 },
        line(0, 100, 0, 200),
        line(0, 60, 0, -25),
        {
          kind: "polygon",
          points: [
            [0, -65],
            [-20, -22],
            [20, -22],
          ],
        },
      ],
    },
    labels: { designator: { x: -150, y: -40 }, value: { x: -150, y: 40 } },
    value: { key: "current", quantity: "current" },
  },
  model: {
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
    // An ideal current source fixes current, not voltage: no DC path through it.
    dcPaths: [],
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
  },
});
