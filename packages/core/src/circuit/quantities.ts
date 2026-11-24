/**
 * Physical quantities used by part properties and readouts (ADR 007 §3).
 *
 * Inside the solver and in files every value is a plain number in SI base units; the quantity only
 * tells the UI which unit to show and accept ("4.7 kΩ"). Parsing with ranges arrives in Step 5.
 */
export const QUANTITIES = {
  resistance: { unit: "Ω", label: "Resistance" },
  conductance: { unit: "S", label: "Conductance" },
  capacitance: { unit: "F", label: "Capacitance" },
  inductance: { unit: "H", label: "Inductance" },
  voltage: { unit: "V", label: "Voltage" },
  current: { unit: "A", label: "Current" },
  power: { unit: "W", label: "Power" },
  frequency: { unit: "Hz", label: "Frequency" },
  time: { unit: "s", label: "Time" },
  temperature: { unit: "°C", label: "Temperature" },
  /** Plain number without a unit (gain, ratio, ideality factor…). */
  ratio: { unit: "", label: "Value" },
  /** Percent, stored as a fraction (5 % → 0.05). */
  percent: { unit: "%", label: "Percent" },
} as const satisfies Record<string, { unit: string; label: string }>;

export type Quantity = keyof typeof QUANTITIES;

export function unitOf(quantity: Quantity): string {
  return QUANTITIES[quantity].unit;
}
