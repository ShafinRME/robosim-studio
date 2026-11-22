"use client";

import { MAX_PROJECT_TABS, type ProjectTabsState } from "@robosim/core";
import { IconButton } from "@robosim/ui/components/button";
import { cn } from "@robosim/ui/lib/utils";
import { Box, Plus, X } from "lucide-react";
import { useRef, type KeyboardEvent } from "react";

/**
 * Open projects as tabs. Each tab is a `tab` button plus a separate close button
 * (a button cannot sit inside another). ←/→ move between tabs, Home/End jump to the ends.
 */
export function ProjectTabStrip({
  state,
  onActivate,
  onClose,
  onNew,
}: {
  state: ProjectTabsState;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
}) {
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());

  function focusAt(index: number) {
    const tab = state.tabs[(index + state.tabs.length) % state.tabs.length];
    if (!tab) return;
    onActivate(tab.id);
    tabRefs.current.get(tab.id)?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>, index: number) {
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: state.tabs.length - 1,
    };
    const target = moves[event.key];
    if (target === undefined) return;
    event.preventDefault();
    focusAt(target);
  }

  return (
    <div className="flex h-8 shrink-0 items-end gap-1 border-b bg-canvas px-2">
      <div role="tablist" aria-label="Open projects" className="flex min-w-0 items-end gap-0.5">
        {state.tabs.map((tab, index) => {
          const active = tab.id === state.activeId;
          return (
            <div
              key={tab.id}
              data-testid="project-tab"
              className={cn(
                "group relative -mb-px flex h-7 max-w-48 min-w-0 items-center rounded-t-md border border-b-0 pr-1",
                active
                  ? "border-border bg-surface-1 text-foreground"
                  : "border-transparent text-muted-foreground hover:bg-surface-1/60 hover:text-foreground",
              )}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute inset-x-2 top-0 h-0.5 rounded-full bg-brand shadow-glow"
                />
              )}
              <button
                ref={(el) => {
                  if (el) tabRefs.current.set(tab.id, el);
                  else tabRefs.current.delete(tab.id);
                }}
                type="button"
                role="tab"
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                onClick={() => onActivate(tab.id)}
                className="flex h-full min-w-0 items-center gap-1.5 pr-1 pl-2.5 text-xs outline-none focus-visible:outline-2 focus-visible:-outline-offset-2"
              >
                <Box className={cn("size-3.5 shrink-0", active && "text-brand")} aria-hidden />
                <span className="truncate">{tab.name}</span>
              </button>
              <IconButton
                label={`Close ${tab.name}`}
                size="icon-sm"
                tabIndex={active ? 0 : -1}
                className="size-5 opacity-60 group-hover:opacity-100 [&_svg]:size-3"
                onClick={() => onClose(tab.id)}
              >
                <X />
              </IconButton>
            </div>
          );
        })}
      </div>
      <IconButton
        label="New project"
        size="icon-sm"
        className="mb-0.5"
        disabled={state.tabs.length >= MAX_PROJECT_TABS}
        onClick={onNew}
      >
        <Plus />
      </IconButton>
    </div>
  );
}
