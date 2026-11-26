/**
 * SPST switch (ADR 010 part file): one contact, open or closed. Modelled the usual SPICE way as a
 * tiny resistance when closed and a huge one when open, so the circuit matrix never becomes
 * singular and an open switch still leaves its pins defined.
 */
import { line } from "../draw";
import { definePart } from "../part";

/** Contact resistance when closed and leakage resistance when open (Ω). */
export const SWITCH_ON_RESISTANCE = 1e-3;
export const SWITCH_OFF_RESISTANCE = 1e9;

export default definePart({
  type: "switch.spst",
  name: "Switch (SPST)",
  description:
    "A simple on/off switch. Closed it connects its two pins; open it breaks the circuit.",
  category: "electromechanical",
  keywords: ["switch", "spst", "toggle", "on off", "button", "sw"],
  designatorPrefix: "SW",
  // Horizontal: pin 1 left, pin 2 right; the lever drawn open.
  symbol: {
    bounds: { minX: -200, minY: -90, maxX: 200, maxY: 20 },
    pins: [
      { id: "1", x: -200, y: 0 },
      { id: "2", x: 200, y: 0 },
    ],
    body: {
      // IEC 60617 make contact: plain lines and a lever.
      iec: [line(-200, 0, -80, 0), line(-80, 0, 70, -80), line(80, 0, 200, 0)],
      // ANSI: contacts drawn as small open circles.
      ansi: [
        line(-200, 0, -95, 0),
        { kind: "circle", cx: -80, cy: 0, r: 15 },
        line(-70, -10, 75, -80),
        { kind: "circle", cx: 80, cy: 0, r: 15 },
        line(95, 0, 200, 0),
      ],
    },
    labels: { designator: { x: 0, y: -130 }, value: { x: 0, y: 70 } },
  },
  model: {
    pins: [
      { id: "1", name: "Pin 1", type: "passive" },
      { id: "2", name: "Pin 2", type: "passive" },
    ],
    properties: [{ kind: "boolean", key: "closed", label: "Closed", default: false }],
    branches: 0,
    stateSize: 0,
    // Even open, the 1 GΩ leakage keeps both sides tied for the solver (no floating-node alarm).
    dcPaths: [[0, 1]],
    create({ props, nodes: [a = 0, b = 0] }) {
      const closed = props.closed === true;
      const g = 1 / (closed ? SWITCH_ON_RESISTANCE : SWITCH_OFF_RESISTANCE);
      return {
        stamp(ctx) {
          ctx.conductance(a, b, g);
        },
        report(solution) {
          const voltage = solution.voltage(a) - solution.voltage(b);
          return [
            { key: "voltage", label: "Voltage", quantity: "voltage", value: voltage },
            { key: "current", label: "Current", quantity: "current", value: voltage * g },
          ];
        },
      };
    },
  },
});
