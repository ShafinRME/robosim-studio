"use client";

import {
  appendMessage,
  resolveLowEnd,
  type DeviceHints,
  type MessageLevel,
  type StatusMessage,
} from "@robosim/core";
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
};

/** Canvas pointer position in canvas pixels, or null when the pointer is outside. */
type Cursor = { x: number; y: number } | null;

const StatusContext = createContext<StudioStatus | null>(null);
// Separate context so pointer moves only re-render what shows the cursor.
const CursorContext = createContext<{ cursor: Cursor; setCursor: (c: Cursor) => void } | null>(
  null,
);

function deviceHints(): DeviceHints {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return { deviceMemory: nav.deviceMemory, hardwareConcurrency: nav.hardwareConcurrency };
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

const lowEndSnapshot = () => resolveLowEnd(readLowEndChoice(), deviceHints());
const lowEndServerSnapshot = () => false;

export function StudioStatusProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<StatusMessage[]>([]);
  const lowEnd = useSyncExternalStore(subscribeLowEnd, lowEndSnapshot, lowEndServerSnapshot);
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

  const setLowEnd = useCallback(
    (on: boolean) => {
      writeLowEndChoice(on);
      post("info", on ? "Low-end mode on: animations off." : "Low-end mode off.");
    },
    [post],
  );

  const status = useMemo(
    () => ({ messages, post, lowEnd, setLowEnd }),
    [messages, post, lowEnd, setLowEnd],
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
