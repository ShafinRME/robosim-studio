import { describe, expect, it } from "vitest";
import { COMPONENTS, componentFor } from "../parts/registry";
import type { ComponentDefinition, PropValue } from "./component";
import { solveCircuitDc, type DcResult } from "./dc";
import type { CircuitInput, CircuitPart, PinRef } from "./netlist";

/**
 * Day 16 "done when": beginner errors are explained, never NaN. Thousands of seeded random
 * circuits — every registered part, extreme and invalid values, shorts, loose pins, missing
 * grounds, parts joined only to each other — must each give either finite results or plain-word
 * problems. Never a throw, never NaN / Infinity, never an empty or "undefined" message, never "something went wrong inside the simulator".
 */

function random(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1_664_525 + 1_013_904_223) >>> 0;
    return s / 2 ** 32;
  };
}

const DEFINITIONS = COMPONENTS.filter((d) => d.pins.length > 0);

function randomValue(definition: ComponentDefinition, key: string, next: () => number): PropValue {
  const property = definition.properties.find((p) => p.key === key);
  if (!property) return 0;
  if (property.kind === "boolean") return next() < 0.5;
  if (property.kind === "choice")
    return property.options[Math.floor(next() * property.options.length)] ?? "";
  const roll = next();
  if (roll < 0.03) return -1; // below the minimum of most parts: must become "invalid value"
  if (roll < 0.15 && property.min !== undefined)
    return property.exclusiveMin ? property.min * 1.000001 || 1e-12 : property.min;
  if (roll < 0.25 && property.max !== undefined) return property.max;
  if (roll < 0.4) return property.default;
  // Log-uniform across the allowed range (or 1 µ … 1 G when open-ended), random sign if allowed.
  const low = Math.max(property.min ?? 1e-6, 1e-6);
  const high = Math.min(property.max ?? 1e9, 1e9);
  if (!(high > low)) return property.default;
  const value = low * (high / low) ** next();
  return property.min !== undefined && property.min >= 0 ? value : next() < 0.5 ? -value : value;
}

/** A random circuit of `size` parts with random wiring. */
function randomCircuit(seed: number): CircuitInput {
  const next = random(seed);
  const pick = <T>(list: readonly T[]) => list[Math.floor(next() * list.length)] as T;
  const size = 1 + Math.floor(next() * 12);
  const parts: CircuitPart[] = [];
  const counts = new Map<string, number>();
  for (let i = 0; i < size; i++) {
    const definition = pick(DEFINITIONS);
    const n = (counts.get(definition.designatorPrefix) ?? 0) + 1;
    counts.set(definition.designatorPrefix, n);
    const props: Record<string, PropValue> = {};
    for (const property of definition.properties) {
      if (next() < 0.6) props[property.key] = randomValue(definition, property.key, next);
    }
    parts.push({
      id: `p${i}`,
      type: definition.type,
      // Now and then two parts share a name (a warning, never a crash).
      designator:
        next() < 0.03 ? `${definition.designatorPrefix}1` : `${definition.designatorPrefix}${n}`,
      pins: definition.pins.map((p) => p.id),
      props,
    });
  }
  // Most circuits have a ground (no ground is one of the mistakes, but not the only one).
  if (next() < 0.85)
    parts.push({ id: "gnd", type: "ground", designator: "GND1", pins: ["1"], props: {} });
  const pins: PinRef[] = parts.flatMap((part) => part.pins.map((pin) => ({ part: part.id, pin })));
  const connections: [PinRef, PinRef][] = [];
  const wires = Math.floor(next() * pins.length * 1.2);
  for (let w = 0; w < wires; w++) {
    const a = pick(pins);
    // Mostly between different pins; sometimes a pin of the same part (shorts).
    const b =
      next() < 0.1
        ? { part: a.part, pin: pick(parts.find((p) => p.id === a.part)?.pins ?? [a.pin]) }
        : pick(pins);
    if (a.part === b.part && a.pin === b.pin) continue;
    connections.push([a, b]);
  }
  return { parts, connections, labels: [] };
}

function problemsIn(result: DcResult): string[] {
  const problems: string[] = [];
  for (const issue of result.issues) {
    if (issue.code === "model-error") problems.push(`simulator fault: ${issue.message}`);
    if (!issue.message || /NaN|Infinity|undefined|null|\[object/.test(issue.message))
      problems.push(`bad message: ${JSON.stringify(issue.message)}`);
    if (issue.hint !== undefined && /NaN|Infinity|undefined|null|\[object/.test(issue.hint))
      problems.push(`bad hint: ${issue.hint}`);
  }
  if (result.ok) {
    if (result.issues.some((i) => i.severity === "error")) problems.push("solved with an error");
    for (const net of result.nets)
      if (!Number.isFinite(net.voltage)) problems.push(`net ${net.name} = ${net.voltage}`);
    for (const part of result.parts) {
      for (const r of part.readouts)
        if (!Number.isFinite(r.value)) problems.push(`${part.designator}.${r.key} = ${r.value}`);
      if (part.floating && part.readouts.length)
        problems.push(`${part.designator} floating with values`);
    }
  } else if (!result.issues.some((i) => i.severity === "error")) {
    problems.push("not solved, but no error says why");
  }
  return problems;
}

describe("never NaN: random circuits", () => {
  it("3 000 random circuits: finite results or plain-word problems, never a throw", () => {
    const outcomes = { solved: 0, refused: 0 };
    const codes = new Set<string>();
    for (let seed = 1; seed <= 3_000; seed++) {
      const input = randomCircuit(seed);
      let result: DcResult;
      try {
        result = solveCircuitDc(input, componentFor);
      } catch (error) {
        throw new Error(`seed ${seed} threw: ${String(error)}`);
      }
      const problems = problemsIn(result);
      expect(problems, `seed ${seed}`).toEqual([]);
      outcomes[result.ok ? "solved" : "refused"]++;
      for (const issue of result.issues) codes.add(issue.code);
    }
    // The generator really covers both outcomes and the beginner mistakes.
    expect(outcomes.solved).toBeGreaterThan(300);
    expect(outcomes.refused).toBeGreaterThan(300);
    for (const code of [
      "no-ground",
      "voltage-source-loop",
      "current-source-cutset",
      "floating-node",
      "invalid-value",
      "unconnected-pin",
      "shorted-part",
      "short-circuit",
    ]) {
      expect(codes, code).toContain(code);
    }
  });

  it("extreme but valid values on every part still solve to finite numbers", () => {
    for (const definition of DEFINITIONS) {
      for (const pickValue of ["min", "max"] as const) {
        const props: Record<string, PropValue> = {};
        for (const property of definition.properties) {
          if (property.kind !== "number") continue;
          const value = property[pickValue];
          if (value === undefined) continue;
          props[property.key] = property.exclusiveMin && pickValue === "min" ? value + 1e-9 : value;
        }
        // The part across a 1 kΩ load and a 5 V supply, grounded.
        const input: CircuitInput = {
          parts: [
            {
              id: "v",
              type: "source.dc-voltage",
              designator: "V1",
              pins: ["+", "-"],
              props: { voltage: 5 },
            },
            { id: "r", type: "resistor", designator: "R1", pins: ["1", "2"], props: {} },
            {
              id: "x",
              type: definition.type,
              designator: "X1",
              pins: definition.pins.map((p) => p.id),
              props,
            },
            { id: "g", type: "ground", designator: "GND1", pins: ["1"], props: {} },
          ],
          connections: [
            [
              { part: "v", pin: "+" },
              { part: "r", pin: "1" },
            ],
            [
              { part: "v", pin: "-" },
              { part: "g", pin: "1" },
            ],
            ...definition.pins.map(
              (p, i) =>
                [
                  { part: "x", pin: p.id },
                  i === 0 ? { part: "r", pin: "2" } : { part: "g", pin: "1" },
                ] as [PinRef, PinRef],
            ),
          ],
          labels: [],
        };
        const result = solveCircuitDc(input, componentFor);
        expect(problemsIn(result), `${definition.type} at ${pickValue}`).toEqual([]);
      }
    }
  });
});
