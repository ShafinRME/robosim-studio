"use client";

/**
 * Parts drawer (ADR 010): every part in the library, grouped by category, with a search that also
 * understands values ("10k", "4k7", "9V"). Works fully by keyboard: type, ↑ / ↓ to choose, Enter
 * to place, Esc to clear. Clicking a part starts placing it on the canvas; a part can also be
 * dragged onto the canvas. Recently placed parts are listed first.
 */
import {
  formatQuantity,
  groupParts,
  partFor,
  searchParts,
  type PartDefinition,
  type PartMatch,
} from "@robosim/core";
import { Input } from "@robosim/ui/components/input";
import { cn } from "@robosim/ui/lib/utils";
import { Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { SymbolIcon } from "../../components/schematic/symbol-icon";
import { useSchematicPrefs } from "../../lib/schematic-prefs";
import {
  PART_DRAG_TYPE,
  encodePartDrag,
  requestPlace,
  setActiveDrag,
  setPartSearchFocus,
  type PlaceRequest,
} from "./part-placement";
import { useRecentParts } from "./recent-parts";
import { useStudioStatus } from "./studio-status";

type Row =
  | { kind: "heading"; label: string }
  | { kind: "part"; match: PartMatch; index: number; key: string };

/** What placing this match means: the part, with the value typed in the search if any. */
function requestOf(match: PartMatch): PlaceRequest {
  return match.preset
    ? { type: match.part.type, props: { [match.preset.key]: match.preset.value } }
    : { type: match.part.type };
}

/** The preset value as it will be shown on the part ("10 kΩ"). */
function presetText(match: PartMatch): string | null {
  if (!match.preset) return null;
  const property = match.part.component?.properties.find((p) => p.key === match.preset?.key);
  return property?.kind === "number"
    ? formatQuantity(match.preset.value, property.quantity)
    : match.preset.text;
}

function PartRow({
  id,
  match,
  active,
  onPick,
  onHover,
}: {
  id: string;
  match: PartMatch;
  active: boolean;
  onPick: () => void;
  onHover: () => void;
}) {
  const { symbolStyle } = useSchematicPrefs();
  const { part } = match;
  const preset = presetText(match);
  return (
    <div
      id={id}
      role="option"
      aria-selected={active}
      data-part-type={part.type}
      title={part.description}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 select-none",
        active ? "bg-brand-soft text-foreground" : "hover:bg-surface-2",
      )}
      draggable
      onDragStart={(event) => {
        setActiveDrag(requestOf(match));
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData(PART_DRAG_TYPE, encodePartDrag(requestOf(match)));
        event.dataTransfer.setData("text/plain", part.name);
        const icon = event.currentTarget.querySelector("svg");
        if (icon) event.dataTransfer.setDragImage(icon, 16, 16);
      }}
      onDragEnd={() => setActiveDrag(null)}
      onClick={onPick}
      onPointerMove={onHover}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-md border bg-canvas p-1",
          active ? "border-brand/60 text-brand" : "text-muted-foreground",
        )}
      >
        <SymbolIcon type={part.type} style={symbolStyle} strokeWidth={16} className="size-full" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-xs font-medium">{part.name}</span>
          {preset ? (
            <span className="rounded-sm bg-brand/15 px-1 font-mono text-2xs text-brand">
              {preset}
            </span>
          ) : null}
        </span>
        <span className="line-clamp-1 text-2xs text-faint-foreground">{part.description}</span>
      </span>
      <span className="shrink-0 font-mono text-2xs text-faint-foreground">
        {part.designatorPrefix}
      </span>
    </div>
  );
}

export function PartsDrawer() {
  const { post } = useStudioStatus();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const listRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => searchParts(query), [query]);
  const recent = useRecentParts();
  const searchRef = useRef<HTMLInputElement>(null);
  // "Add part" (A on the canvas) puts the cursor here.
  useEffect(
    () =>
      setPartSearchFocus(() => {
        searchRef.current?.focus();
        searchRef.current?.select();
      }),
    [],
  );
  // Grouped by category when browsing; best match first when searching.
  const rows = useMemo((): Row[] => {
    if (query.trim()) {
      return matches.map((match, index) => ({ kind: "part", match, index, key: match.part.type }));
    }
    let index = 0;
    const recentParts = recent.flatMap((type) => {
      const part = partFor(type);
      return part ? [part] : [];
    });
    const groups = [
      ...(recentParts.length ? [{ label: "Recently used", parts: recentParts }] : []),
      ...groupParts(),
    ];
    return groups.flatMap((group): Row[] => [
      { kind: "heading", label: group.label },
      ...group.parts.map((part): Row => ({
        kind: "part",
        match: { part, score: 0 },
        index: index++,
        key: `${group.label}:${part.type}`,
      })),
    ]);
  }, [query, matches, recent]);
  const ordered = rows.flatMap((r) => (r.kind === "part" ? [r.match] : []));
  const current = Math.min(active, Math.max(ordered.length - 1, 0));
  const optionId = (i: number) => `${listId}-option-${i}`;

  const pick = (match: PartMatch | undefined) => {
    if (!match) return;
    if (requestPlace(requestOf(match))) {
      post("info", `Placing ${describe(match.part)}: click on the canvas, Esc to stop.`);
    } else {
      post("warning", "Open the Canvas panel to place parts (View → Canvas).");
    }
  };

  const move = (to: number) => {
    const next = Math.max(0, Math.min(to, ordered.length - 1));
    setActive(next);
    document.getElementById(optionId(next))?.scrollIntoView({ block: "nearest" });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        move(current + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        move(current - 1);
        break;
      case "Home":
        if (!query) {
          event.preventDefault();
          move(0);
        }
        break;
      case "End":
        if (!query) {
          event.preventDefault();
          move(ordered.length - 1);
        }
        break;
      case "Enter":
        event.preventDefault();
        pick(ordered[current]);
        break;
      case "Escape":
        if (query) {
          event.preventDefault();
          setQuery("");
          setActive(0);
        }
        break;
    }
  };

  return (
    <div className="flex h-full flex-col" data-testid="parts-drawer">
      <div className="border-b p-2">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-faint-foreground"
            aria-hidden
          />
          <Input
            ref={searchRef}
            type="search"
            role="combobox"
            aria-label="Search parts"
            aria-expanded
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={ordered.length ? optionId(current) : undefined}
            placeholder="Search, or type a value: 10k, 9V…"
            value={query}
            maxLength={64}
            spellCheck={false}
            autoComplete="off"
            className="pr-7 pl-7 [&::-webkit-search-cancel-button]:hidden"
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
              listRef.current?.scrollTo({ top: 0 });
            }}
            onKeyDown={onKeyDown}
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              className="absolute top-1/2 right-1.5 flex size-5 -translate-y-1/2 items-center justify-center rounded-sm text-faint-foreground hover:bg-surface-2 hover:text-foreground"
              onClick={() => {
                setQuery("");
                setActive(0);
              }}
            >
              <X className="size-3.5" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
      <div
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label="Parts"
        className="min-h-0 flex-1 overflow-y-auto p-1.5"
      >
        {rows.map((row) =>
          row.kind === "heading" ? (
            <div
              key={`h-${row.label}`}
              role="presentation"
              className="sticky top-0 z-10 bg-surface-1 px-2 pt-2 pb-1 font-mono text-2xs font-semibold tracking-[0.12em] text-faint-foreground uppercase"
            >
              {row.label}
            </div>
          ) : (
            <PartRow
              key={row.key}
              id={optionId(row.index)}
              match={row.match}
              active={row.index === current}
              onPick={() => {
                setActive(row.index);
                pick(row.match);
              }}
              onHover={() => {
                if (row.index !== current) setActive(row.index);
              }}
            />
          ),
        )}
        {ordered.length === 0 ? (
          <p className="px-2 py-6 text-center text-2xs text-faint-foreground" role="status">
            No parts match “{query.trim()}”. Try a shorter word, a part name or a value like 10k.
          </p>
        ) : null}
      </div>
      <p className="border-t px-2.5 py-1.5 text-2xs text-faint-foreground" aria-live="polite">
        {query.trim()
          ? `${ordered.length} ${ordered.length === 1 ? "part" : "parts"} found`
          : `${matches.length} parts`}{" "}
        · click, Enter or drag to place
      </p>
    </div>
  );
}

/** "Resistor" → "resistor", keeps acronyms ("DC voltage source"). */
function describe(part: PartDefinition): string {
  const name = partFor(part.type)?.name ?? part.type;
  return /^[A-Z][a-z]/.test(name) ? name.charAt(0).toLowerCase() + name.slice(1) : name;
}
