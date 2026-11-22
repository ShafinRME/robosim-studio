"use client";

import { isCommandEnabled, searchCommands, type Command } from "@robosim/core";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Search } from "lucide-react";
import { useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Kbd, KbdGroup } from "@robosim/ui/components/kbd";
import { cn } from "@robosim/ui/lib/utils";

/** Title with the matched characters highlighted. */
function Highlight({ text, indices }: { text: string; indices: readonly number[] }) {
  if (indices.length === 0) return <>{text}</>;
  const hit = new Set(indices);
  return (
    <>
      {[...text].map((ch, i) =>
        hit.has(i) ? (
          <mark key={i} className="bg-transparent font-semibold text-brand">
            {ch}
          </mark>
        ) : (
          <span key={i}>{ch}</span>
        ),
      )}
    </>
  );
}

export type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: readonly Command[];
  /** Ids of recently run commands, shown first when the search is empty. */
  recent?: readonly string[];
  /** Keys to show for a command, e.g. { "view.resetLayout": ["Ctrl", "Alt", "R"] }. */
  shortcuts?: Readonly<Record<string, readonly string[]>>;
  /** Runs the chosen command (the palette closes first). */
  onRun: (id: string) => void;
};

/**
 * Command palette: type to search every studio command, ↑/↓ to choose, Enter to run, Esc to close.
 * Accessible combobox: the input owns a listbox and points at the active option.
 */
export function CommandPalette({
  open,
  onOpenChange,
  commands,
  recent,
  shortcuts,
  onRun,
}: CommandPaletteProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-canvas/60 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            "fixed top-[14vh] left-1/2 z-50 flex w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 flex-col overflow-hidden rounded-lg bg-surface-2 shadow-popover",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          )}
        >
          <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
          {/* Remount on every open so the search starts empty. */}
          {open && (
            <PaletteBody
              commands={commands}
              recent={recent}
              shortcuts={shortcuts}
              onRun={(id) => {
                onOpenChange(false);
                onRun(id);
              }}
            />
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function PaletteBody({
  commands,
  recent,
  shortcuts,
  onRun,
}: Pick<CommandPaletteProps, "commands" | "recent" | "shortcuts" | "onRun">) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(() => searchCommands(commands, query, recent), [commands, query, recent]);
  const activeIndex = Math.min(active, Math.max(results.length - 1, 0));
  const activeResult = results[activeIndex];
  const optionId = (i: number) => `${listId}-option-${i}`;

  useLayoutEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex]);

  function choose(index: number) {
    const result = results[index];
    if (result && isCommandEnabled(result.command)) onRun(result.command.id);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const count = results.length;
    if (event.key === "ArrowDown" && count > 0) {
      event.preventDefault();
      setActive((activeIndex + 1) % count);
    } else if (event.key === "ArrowUp" && count > 0) {
      event.preventDefault();
      setActive((activeIndex - 1 + count) % count);
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(activeIndex);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 border-b px-3">
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          autoFocus
          role="combobox"
          aria-label="Search commands"
          aria-expanded
          aria-controls={listId}
          aria-activedescendant={activeResult ? optionId(activeIndex) : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
          maxLength={100}
          placeholder="Type a command…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint-foreground"
        />
        <Kbd>Esc</Kbd>
      </div>

      <ul
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label="Commands"
        className="max-h-[min(22rem,60vh)] overflow-y-auto p-1"
      >
        {results.map((result, index) => {
          const { command } = result;
          const enabled = isCommandEnabled(command);
          const keys = shortcuts?.[command.id];
          return (
            <li
              key={command.id}
              id={optionId(index)}
              data-index={index}
              role="option"
              aria-selected={index === activeIndex}
              aria-disabled={!enabled || undefined}
              onPointerMove={() => index !== activeIndex && setActive(index)}
              onClick={() => choose(index)}
              className={cn(
                "flex h-8 cursor-default items-center gap-2 rounded-sm px-2 text-sm select-none",
                index === activeIndex && "bg-brand-soft",
                !enabled && "opacity-45",
              )}
            >
              <span className="w-14 shrink-0 font-mono text-2xs tracking-wider text-faint-foreground uppercase">
                {command.category}
              </span>
              <span className="min-w-0 flex-1 truncate">
                <Highlight text={command.title} indices={result.titleIndices} />
              </span>
              {keys && (
                <KbdGroup>
                  {keys.map((key) => (
                    <Kbd key={key}>{key}</Kbd>
                  ))}
                </KbdGroup>
              )}
            </li>
          );
        })}
      </ul>
      {results.length === 0 && (
        <p className="px-3 pb-4 text-center text-xs text-muted-foreground">No matching commands</p>
      )}

      <div className="flex items-center gap-3 border-t px-3 py-1.5 font-mono text-2xs text-faint-foreground">
        <span className="flex items-center gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> choose
        </span>
        <span className="flex items-center gap-1">
          <Kbd>Enter</Kbd> run
        </span>
        <span className="ml-auto">{results.length} commands</span>
      </div>
    </>
  );
}
