/**
 * Studio status: the message log shown in the status bar and Console panel, and the
 * Low-end mode decision for slower computers (8 GB RAM, integrated graphics).
 */

export type MessageLevel = "info" | "success" | "warning" | "error";

export type StatusMessage = {
  id: number;
  level: MessageLevel;
  text: string;
  /** Milliseconds since the epoch. */
  time: number;
};

/** The log keeps only the newest messages. */
export const MAX_STATUS_MESSAGES = 200;
const MAX_MESSAGE_CHARS = 500;

/** Appends a message, trimming very long text and dropping the oldest beyond the limit. */
export function appendMessage(
  log: readonly StatusMessage[],
  message: Omit<StatusMessage, "id">,
): StatusMessage[] {
  const id = (log.at(-1)?.id ?? 0) + 1;
  const text =
    message.text.length > MAX_MESSAGE_CHARS
      ? `${message.text.slice(0, MAX_MESSAGE_CHARS - 1)}…`
      : message.text;
  const next = [...log, { ...message, id, text }];
  return next.length > MAX_STATUS_MESSAGES ? next.slice(-MAX_STATUS_MESSAGES) : next;
}

/** "14:05:09" in 24-hour time, for log lines. */
export function formatClock(time: number): string {
  const date = new Date(time);
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}

/** What the browser tells us about the computer. Both values may be missing. */
export type DeviceHints = { deviceMemory?: number; hardwareConcurrency?: number };

/** At or below these, the studio suggests Low-end mode. */
export const LOW_END_MAX_MEMORY_GB = 4;
export const LOW_END_MAX_CORES = 2;

/**
 * Suggests Low-end mode from the browser's hints. `deviceMemory` is rounded down and capped
 * at 8 GB by browsers, so only clearly small machines are flagged.
 */
export function detectLowEnd(hints: DeviceHints): boolean {
  const { deviceMemory, hardwareConcurrency } = hints;
  if (typeof deviceMemory === "number" && deviceMemory > 0) {
    if (deviceMemory <= LOW_END_MAX_MEMORY_GB) return true;
  }
  if (typeof hardwareConcurrency === "number" && hardwareConcurrency > 0) {
    if (hardwareConcurrency <= LOW_END_MAX_CORES) return true;
  }
  return false;
}

/** Stored choice ("on" / "off"); anything else means "not chosen, use detection". */
export function resolveLowEnd(stored: string | null, hints: DeviceHints): boolean {
  if (stored === "on") return true;
  if (stored === "off") return false;
  return detectLowEnd(hints);
}
