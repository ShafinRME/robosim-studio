/**
 * Test helpers only (not exported from the package): a tiny dense solver and an end-to-end
 * "netlist → devices → stamps → solve → reports" run, until the real solver arrives (Day 15).
 */
import { componentFor } from "../parts/registry";
import { createDevice, type Device } from "./component";
import type { DefinitionLookup } from "./issues";
import { createDenseMna, createSolution } from "./mna";
import { buildNetlist, type CircuitInput } from "./netlist";

/** Test-only Gaussian elimination with partial pivoting (the real LU solver arrives on Day 15). */
export function solveDense(matrix: Float64Array, rhs: Float64Array, n: number): Float64Array {
  const a = Float64Array.from(matrix);
  const x = Float64Array.from(rhs);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++)
      if (Math.abs(a[r * n + col] ?? 0) > Math.abs(a[pivot * n + col] ?? 0)) pivot = r;
    if (Math.abs(a[pivot * n + col] ?? 0) < 1e-15) throw new Error("singular");
    for (let c = 0; c < n; c++)
      [a[col * n + c], a[pivot * n + c]] = [a[pivot * n + c] ?? 0, a[col * n + c] ?? 0];
    [x[col], x[pivot]] = [x[pivot] ?? 0, x[col] ?? 0];
    for (let r = col + 1; r < n; r++) {
      const f = (a[r * n + col] ?? 0) / (a[col * n + col] ?? 1);
      for (let c = col; c < n; c++) a[r * n + c] = (a[r * n + c] ?? 0) - f * (a[col * n + c] ?? 0);
      x[r] = (x[r] ?? 0) - f * (x[col] ?? 0);
    }
  }
  for (let r = n - 1; r >= 0; r--) {
    let sum = x[r] ?? 0;
    for (let c = r + 1; c < n; c++) sum -= (a[r * n + c] ?? 0) * (x[c] ?? 0);
    x[r] = sum / (a[r * n + r] ?? 1);
  }
  return x;
}

/** Netlist → devices → stamps → solve → reports: the whole Day 11 contract end to end. */
export function simulate(input: CircuitInput, lookup: DefinitionLookup = componentFor) {
  const netlist = buildNetlist(input);
  let branch = 0;
  const devices = new Map<string, Device>();
  for (const component of netlist.components) {
    const definition = lookup(component.type);
    if (!definition) throw new Error(`unknown part ${component.type}`);
    const created = createDevice(definition, component, branch, 0);
    if (!created.ok) throw new Error(JSON.stringify(created.problems));
    devices.set(component.designator, created.device);
    branch += definition.branches;
  }
  const mna = createDenseMna(netlist.nets.length, branch);
  for (const device of devices.values()) device.stamp(mna.context);
  const solution = createSolution(
    solveDense(mna.matrix, mna.rhs, mna.size),
    netlist.nets.length,
    branch,
  );
  const report = (designator: string) =>
    Object.fromEntries(
      (devices.get(designator)?.report(solution) ?? []).map((r) => [r.key, r.value]),
    );
  return { netlist, solution, report };
}
