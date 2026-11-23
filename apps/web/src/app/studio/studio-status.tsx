"use client";

import {
  appendMessage,
  assessCapabilities,
  describeLowEndReason,
  resolveLowEnd,
  type MessageLevel,
  type StatusMessage,
} from "@robosim/core";
import { readCapabilityHints } from "../../lib/device-capabilities";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

const LOW_END_KEY = "robosim-low-end";

type StudioStatus = {
  messages: readonly StatusMessage[];
  post: (level: MessageLevel, text: string) => void;
  lowEnd: boolean;
  setLowEnd: (on: boolean) => void;
  /** Why this computer gets Low-end mode by default (empty: it does not). */
  lowEndReasons: readonly string[];
  /** True when Low-end mode follows the automatic choice (the user never switched it). */
  lowEndAuto: boolean;
};

/** Canvas pointer position in canvas pixels, or null when the pointer is outside. */
type Cursor = { x: number; y: number } | null;

const StatusContext = createContext<StudioStatus | null>(null);
// Separate context so pointer moves only re-render what shows the cursor.
const CursorContext = createContext<{ cursor: Cursor; setCursor: (c: Cursor) => void } | null>(
  null,
);

/** Plain-language reasons this computer gets Low-end mode by default. */
function lowEndReasons(): string[] {
  const report = assessCapabilities(readCapabilityHints());
  return report.lowEndReasons.map((reason) => describeLowEndReason(reason, report));
}

// Low-end mode is a small external store: the stored choice (or device hints) in the browser,
// always "off" during the server render. A memory copy keeps working when storage is blocked.
let lowEndChoice: string | null | undefined;
const lowEndListeners = new Set<() => void>();

function readLowEndChoice(): string | null {
  if (lowEndChoice !== undefined) return lowEndChoice;
  try {
    lowEndChoice = window.localStorage.getItem(LOW_END_KEY);
  } catch {
    lowEndChoice = null;
  }
  return lowEndChoice;
}

function writeLowEndChoice(on: boolean) {
  lowEndChoice = on ? "on" : "off";
  try {
    window.localStorage.setItem(LOW_END_KEY, lowEndChoice);
  } catch {
    // The choice just won't be remembered after a reload.
  }
  for (const listener of lowEndListeners) listener();
}

function subscribeLowEnd(listener: () => void) {
  lowEndListeners.add(listener);
  return () => lowEndListeners.delete(listener);
}

const lowEndSnapshot = () => resolveLowEnd(readLowEndChoice(), readCapabilityHints());
const lowEndServerSnapshot = () => false;
const choiceSnapshot = () => readLowEndChoice();
const choiceServerSnapshot = () => "off";
/** The automatic Low-end notice is shown once per page. */
let autoNoticeShown = false;

export function StudioStatusProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<StatusMessage[]>([]);
  const lowEnd = useSyncExternalStore(subscribeLowEnd, lowEndSnapshot, lowEndServerSnapshot);
  const choice = useSyncExternalStore(subscribeLowEnd, choiceSnapshot, choiceServerSnapshot);
  const lowEndAuto = choice !== "on" && choice !== "off";
  const [reasons] = useState<string[]>(() =>
    typeof window === "undefined" ? [] : lowEndReasons(),
  );
  const [cursor, setCursor] = useState<Cursor>(null);

  const post = useCallback((level: MessageLevel, text: string) => {
    setMessages((log) => appendMessage(log, { level, text, time: Date.now() }));
  }, []);

  // Mark the page so the CSS in globals.css can switch animations off.
  useEffect(() => {
    const root = document.documentElement;
    if (lowEnd) root.dataset.lowEnd = "";
    else delete root.dataset.lowEnd;
    return () => {
      delete root.dataset.lowEnd;
    };
  }, [lowEnd]);

  // Say once why Low-end mode switched itself on, and how to turn it off.
  useEffect(() => {
    if (!lowEnd || !lowEndAuto || autoNoticeShown) return;
    autoNoticeShown = true;
    const why = reasons.join(", ") || "limited hardware";
    // After this render, not during the effect (avoids a cascading render).
    queueMicrotask(() =>
      post(
        "info",
        `Low-end mode is on for this computer (${why}). You can turn it off in the status bar.`,
      ),
    );
  }, [lowEnd, lowEndAuto, reasons, post]);

  const setLowEnd = useCallback(
    (on: boolean) => {
      writeLowEndChoice(on);
      post("info", on ? "Low-end mode on: animations off, lighter updates." : "Low-end mode off.");
    },
    [post],
  );

  const status = useMemo(
    () => ({ messages, post, lowEnd, setLowEnd, lowEndReasons: reasons, lowEndAuto }),
    [messages, post, lowEnd, setLowEnd, reasons, lowEndAuto],
  );
  const cursorValue = useMemo(() => ({ cursor, setCursor }), [cursor]);

  return (
    <StatusContext.Provider value={status}>
      <CursorContext.Provider value={cursorValue}>{children}</CursorContext.Provider>
    </StatusContext.Provider>
  );
}

export function useStudioStatus(): StudioStatus {
  const value = useContext(StatusContext);
  if (!value) throw new Error("useStudioStatus must be used inside StudioStatusProvider");
  return value;
}

export function useCanvasCursor() {
  const value = useContext(CursorContext);
  if (!value) throw new Error("useCanvasCursor must be used inside StudioStatusProvider");
  return value;
}
