/**
 * Potentiometer (ADR 010 part file): a resistor with a sliding contact (wiper). Between pin 1 and
 * the wiper is `position` × R, between the wiper and pin 2 the rest. At the very ends a small
 * minimum resistance keeps the circuit solvable.
 */
import { numberProp } from "../../circuit/component";
import { ZIGZAG, line } from "../draw";
import { definePart } from "../part";

/** Smallest resistance of either half, so a wiper at 0 % or 100 % is not a perfect short (Ω). */
export const POT_MIN_RESISTANCE = 1e-3;

const ARROW: readonly (readonly [number, number])[] = [
  [0, -45],
  [-22, -90],
  [22, -90],
];

export default definePart({
  type: "resistor.potentiometer",
  name: "Potentiometer",
  description:
    "A resistor with a sliding wiper: a voltage divider you can turn, like a volume knob.",
  category: "passive",
  keywords: ["pot", "trimmer", "variable resistor", "divider", "knob", "rheostat", "wiper"],
  designatorPrefix: "RV",
  // Horizontal resistor, pin 1 left, pin 2 right; wiper on top with an arrow onto the body.
  symbol: {
    bounds: { minX: -200, minY: -200, maxX: 200, maxY: 40 },
    pins: [
      { id: "1", x: -200, y: 0 },
      { id: "2", x: 200, y: 0 },
      { id: "w", x: 0, y: -200 },
    ],
    body: {
      iec: [
        line(-200, 0, -100, 0),
        { kind: "rect", x: -100, y: -40, width: 200, height: 80 },
        line(100, 0, 200, 0),
        line(0, -200, 0, -90),
        { kind: "polygon", points: ARROW },
      ],
      ansi: [
        line(-200, 0, -100, 0),
        { kind: "polyline", points: ZIGZAG },
        line(100, 0, 200, 0),
        line(0, -200, 0, -90),
        { kind: "polygon", points: ARROW },
      ],
    },
    // Both labels under the body (the wiper is on top): "RV1" over "10 kΩ".
    labels: { designator: { x: 0, y: 90 }, value: { x: 0, y: 90 } },
    value: { key: "resistance", quantity: "resistance" },
  },
  model: {
    pins: [
      { id: "1", name: "End 1", type: "passive" },
      { id: "2", name: "End 2", type: "passive" },
      { id: "w", name: "Wiper", type: "passive" },
    ],
    properties: [
      {
        kind: "number",
        key: "resistance",
        label: "Resistance",
        quantity: "resistance",
        default: 10_000,
        min: 0,
        exclusiveMin: true,
        max: 1e9,
      },
      {
        kind: "number",
        key: "position",
        label: "Wiper position",
        quantity: "percent",
        default: 0.5,
        min: 0,
        max: 1,
      },
    ],
    branches: 0,
    stateSize: 0,
    create({ props, nodes: [a = 0, b = 0, w = 0] }) {
      const r = numberProp(props, "resistance");
      const position = numberProp(props, "position");
      const g1 = 1 / Math.max(r * position, POT_MIN_RESISTANCE);
      const g2 = 1 / Math.max(r * (1 - position), POT_MIN_RESISTANCE);
      return {
        stamp(ctx) {
          ctx.conductance(a, w, g1);
          ctx.conductance(w, b, g2);
        },
        report(solution) {
          const va = solution.voltage(a);
          const vb = solution.voltage(b);
          const vw = solution.voltage(w);
          const i1 = (va - vw) * g1;
          const i2 = (vw - vb) * g2;
          return [
            { key: "voltage", label: "Voltage (1 → 2)", quantity: "voltage", value: va - vb },
            {
              key: "wiper",
              label: "Wiper (to 2)",
              quantity: "voltage",
              value: vw - vb,
            },
            { key: "current", label: "Current (pin 1)", quantity: "current", value: i1 },
            {
              key: "power",
              label: "Power",
              quantity: "power",
              value: (va - vw) * i1 + (vw - vb) * i2,
            },
          ];
        },
      };
    },
  },
});
