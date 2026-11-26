/**
 * Ground (ADR 010 part file): the 0 V reference. It has no electrical model — `buildNetlist` makes
 * its pin node 0 (ADR 007).
 */
import { both, line } from "../draw";
import { definePart } from "../part";

export default definePart({
  type: "ground",
  name: "Ground",
  description: "The 0 V reference point. Every circuit needs one to measure voltages from.",
  category: "power",
  keywords: ["gnd", "0v", "earth", "reference", "common"],
  designatorPrefix: "GND",
  role: "ground",
  // Pin on top, three bars.
  symbol: {
    bounds: { minX: -100, minY: 0, maxX: 100, maxY: 180 },
    pins: [{ id: "1", x: 0, y: 0 }],
    body: both([
      line(0, 0, 0, 100),
      line(-100, 100, 100, 100),
      line(-60, 140, 60, 140),
      line(-20, 180, 20, 180),
    ]),
  },
});
