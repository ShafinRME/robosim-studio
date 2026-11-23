/**
 * Signal Bus (ADR 006): how pins, wires, sensors, motors and controllers exchange values.
 *
 * A signal is a declared, named value: a number (with a unit and an optional range) or a boolean.
 * The bus is **double-buffered**: a write during a step becomes visible only after `commit()` — at the
 * next step. So inside one step every model reads the same values, and the order in which models
 * run never changes the result. A signal may be written at most once per step (one writer), which
 * keeps that guarantee even when two models write to the same signal by mistake.
 */

export const MAX_SIGNALS = 10_000;
export const MAX_SIGNAL_NAME_CHARS = 64;
// Lower-case words joined by single '.', '_' or '-' (bounded and unambiguous: no ReDoS).
const NAME_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const MAX_UNIT_CHARS = 16;

export type SignalValue = number | boolean;

export type NumberSignal = {
  name: string;
  kind: "number";
  /** SI unit symbol shown next to the value, e.g. "V", "m/s". */
  unit?: string;
  /** Written values are clamped to this range. */
  min?: number;
  max?: number;
  initial?: number;
};

export type BooleanSignal = { name: string; kind: "boolean"; initial?: boolean };

export type SignalDefinition = NumberSignal | BooleanSignal;

export class SignalBusError extends Error {
  override name = "SignalBusError";
}

function checkDefinition(def: SignalDefinition): SignalDefinition {
  if (
    typeof def.name !== "string" ||
    def.name.length > MAX_SIGNAL_NAME_CHARS ||
    !NAME_PATTERN.test(def.name)
  ) {
    throw new SignalBusError(`bad signal name "${String(def.name).slice(0, 80)}"`);
  }
  if (def.kind === "boolean") {
    if (def.initial !== undefined && typeof def.initial !== "boolean") {
      throw new SignalBusError(`${def.name}: initial value must be true or false`);
    }
    return { name: def.name, kind: "boolean", initial: def.initial ?? false };
  }
  // Definitions can come from untrusted data at runtime, whatever the type says.
  if ((def as { kind: unknown }).kind !== "number") {
    throw new SignalBusError(`${(def as { name: string }).name}: unknown kind`);
  }
  const { min = -Infinity, max = Infinity, unit } = def;
  if (Number.isNaN(min) || Number.isNaN(max) || min > max) {
    throw new SignalBusError(`${def.name}: bad range`);
  }
  if (unit !== undefined && (typeof unit !== "string" || unit.length > MAX_UNIT_CHARS)) {
    throw new SignalBusError(`${def.name}: bad unit`);
  }
  const initial = def.initial ?? Math.min(Math.max(0, min), max);
  if (!Number.isFinite(initial) || initial < min || initial > max) {
    throw new SignalBusError(`${def.name}: initial value out of range`);
  }
  return {
    name: def.name,
    kind: "number",
    ...(unit !== undefined && { unit }),
    ...(def.min !== undefined && { min }),
    ...(def.max !== undefined && { max }),
    initial,
  };
}

export type SignalBus = ReturnType<typeof createSignalBus>;

export function createSignalBus() {
  const index = new Map<string, number>();
  const definitions: SignalDefinition[] = [];
  /** Values every model reads during the current step. */
  const current: SignalValue[] = [];
  /** Writes made during the current step, applied by `commit()`. */
  const pending = new Map<number, SignalValue>();

  const slot = (name: string): number => {
    const i = index.get(name);
    if (i === undefined) throw new SignalBusError(`unknown signal "${name.slice(0, 80)}"`);
    return i;
  };

  return {
    /** Declares a signal. Declaring the same name again is an error. */
    declare(definition: SignalDefinition) {
      const def = checkDefinition(definition);
      if (index.has(def.name)) throw new SignalBusError(`signal "${def.name}" already declared`);
      if (definitions.length >= MAX_SIGNALS) {
        throw new SignalBusError(`at most ${MAX_SIGNALS} signals`);
      }
      index.set(def.name, definitions.length);
      definitions.push(def);
      current.push(def.initial as SignalValue);
    },

    has: (name: string) => index.has(name),
    definition: (name: string): SignalDefinition => definitions[slot(name)]!,
    names: (): string[] => definitions.map((d) => d.name),

    /** The value visible in this step. */
    read(name: string): SignalValue {
      return current[slot(name)]!;
    },
    readNumber(name: string): number {
      const value = current[slot(name)];
      if (typeof value !== "number") throw new SignalBusError(`"${name}" is not a number signal`);
      return value;
    },
    readBoolean(name: string): boolean {
      const value = current[slot(name)];
      if (typeof value !== "boolean") throw new SignalBusError(`"${name}" is not a boolean signal`);
      return value;
    },

    /** Writes a value for the next step. Numbers are clamped to the declared range. */
    write(name: string, value: SignalValue) {
      const i = slot(name);
      const def = definitions[i]!;
      if (pending.has(i)) throw new SignalBusError(`"${name}" written twice in one step`);
      if (def.kind === "boolean") {
        if (typeof value !== "boolean") throw new SignalBusError(`"${name}" needs true or false`);
        pending.set(i, value);
        return;
      }
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new SignalBusError(`"${name}" needs a finite number`);
      }
      pending.set(i, Math.min(Math.max(value, def.min ?? -Infinity), def.max ?? Infinity));
    },

    /** Ends a step: this step's writes become the values read in the next one. */
    commit() {
      for (const [i, value] of pending) current[i] = value;
      pending.clear();
    },

    /** Every signal back to its initial value; pending writes are dropped. */
    reset() {
      pending.clear();
      definitions.forEach((def, i) => {
        current[i] = def.initial as SignalValue;
      });
    },

    /** Current values by name (all signals, or the given ones that exist). */
    snapshot(names?: readonly string[]): Record<string, SignalValue> {
      const out: Record<string, SignalValue> = {};
      for (const name of names ?? index.keys()) {
        const i = index.get(name);
        if (i !== undefined) out[name] = current[i]!;
      }
      return out;
    },
  };
}
