"use client";

/**
 * Inspector section for the schematic selection (Day 12): one part → designator, value, position
 * and orientation; several parts → how many. Fields edit on Enter or when they lose focus, Esc puts
 * the current value back; each change is one undoable edit. Values are typed like on real parts
 * ("4k7", "4.7 kΩ", "100n") and checked against the part's range with a plain-word message.
 */
import {
  NetlistError,
  partFor,
  ProjectEditError,
  buildNetlist,
  connectivityOf,
  formatLength,
  formatQuantity,
  netNameOf,
  parseQuantity,
  projectEdits,
  symbolFor,
  type NetLabel,
  type NumberProperty,
  type Part,
  type ProjectEdit,
  type ProjectStore,
  type Wire,
} from "@robosim/core";
import { Input } from "@robosim/ui/components/input";
import { InspectorRow, InspectorSection, InspectorValue } from "@robosim/ui/components/inspector";
import { useMemo, useState } from "react";
import { useSchematicPrefs } from "../../lib/schematic-prefs";
import { useStudioStatus } from "./studio-status";

/** A text field that commits on Enter / blur and restores on Esc. */
function CommitField({
  id,
  value,
  label,
  onCommit,
}: {
  id: string;
  value: string;
  label: string;
  /** Returns false to put the old value back. */
  onCommit: (text: string) => boolean;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <Input
      id={id}
      value={draft}
      aria-label={label}
      spellCheck={false}
      maxLength={40}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (draft.trim() === value) return setDraft(value);
        if (!onCommit(draft.trim())) setDraft(value);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          const input = event.currentTarget;
          setDraft(value);
          requestAnimationFrame(() => input.blur());
        }
      }}
    />
  );
}

function orientation(part: Part): string {
  return `${part.rotation}°${part.flip ? " · mirrored" : ""}`;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** Total length of a wire in mils. */
function wireLength(wire: Wire): number {
  let total = 0;
  for (let i = 1; i < wire.points.length; i++) {
    const [x1, y1] = wire.points[i - 1] as [number, number];
    const [x2, y2] = wire.points[i] as [number, number];
    total += Math.abs(x2 - x1) + Math.abs(y2 - y1);
  }
  return total;
}

/** Net name and the pins on it ("R1.2, V1.+") for one wire, like an EDA net inspector. */
function useWireNet(
  parts: readonly Part[],
  wires: readonly Wire[],
  labels: readonly NetLabel[],
  wireId: string | null,
) {
  return useMemo(() => {
    if (!wireId) return null;
    const c = connectivityOf({ parts, wires, labels });
    let netlist;
    try {
      netlist = buildNetlist(c.input);
    } catch (error) {
      if (error instanceof NetlistError) return null;
      throw error;
    }
    const name = netNameOf(c, netlist, labels, wireId);
    const net = name ? netlist.nets.find((n) => n.name === name) : undefined;
    const designator = new Map(netlist.components.map((x) => [x.id, x.designator]));
    const pins = (net?.pins ?? [])
      .filter((p) => parts.find((x) => x.id === p.part)?.type !== "ground")
      .map((p) => `${designator.get(p.part) ?? p.part}.${p.pin}`)
      .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
    return { name, pins };
  }, [parts, wires, labels, wireId]);
}

export function PartInspector({
  store,
  parts,
  wires = [],
  labels = [],
  selectedIds,
}: {
  store: ProjectStore;
  parts: readonly Part[];
  wires?: readonly Wire[];
  labels?: readonly NetLabel[];
  selectedIds: readonly string[];
}) {
  const { post } = useStudioStatus();
  const { lengthUnit } = useSchematicPrefs();
  const selected = parts.filter((p) => selectedIds.includes(p.id));
  const selectedWires = wires.filter((w) => selectedIds.includes(w.id));
  const selectedLabels = labels.filter((l) => selectedIds.includes(l.id));
  const total = selected.length + selectedWires.length + selectedLabels.length;
  const loneWire = total === 1 ? (selectedWires[0] ?? null) : null;
  const wireNet = useWireNet(parts, wires, labels, loneWire?.id ?? null);
  if (total === 0) return null;

  const apply = (edit: () => ProjectEdit) => {
    try {
      store.getState().apply(edit());
      return true;
    } catch (error) {
      if (!(error instanceof ProjectEditError)) throw error;
      post("warning", error.message);
      return false;
    }
  };

  const loneLabel = total === 1 ? (selectedLabels[0] ?? null) : null;
  if (loneLabel) {
    const sameName = labels.filter((l) => l.name === loneLabel.name).length;
    return (
      <InspectorSection id="part" title="Net label">
        <InspectorRow label="Net name">
          {(id) => (
            <CommitField
              key={`${loneLabel.id}:${loneLabel.name}`}
              id={id}
              label="Net name"
              value={loneLabel.name}
              onCommit={(text) => {
                if (!/^[A-Za-z0-9_+.-]{1,32}$/.test(text)) {
                  post(
                    "warning",
                    "A net name has 1–32 letters, digits or _ + . - (e.g. VCC, OUT).",
                  );
                  return false;
                }
                return apply(() => projectEdits.renameLabel(loneLabel.id, text));
              }}
            />
          )}
        </InspectorRow>
        <InspectorRow label="Joins">
          <InspectorValue tone="muted">
            {sameName > 1
              ? `${plural(sameName, "label")} named ${loneLabel.name}`
              : "Only this label"}
          </InspectorValue>
        </InspectorRow>
        <InspectorRow label="Orientation">
          <InspectorValue tone="muted">{loneLabel.rotation}°</InspectorValue>
        </InspectorRow>
      </InspectorSection>
    );
  }

  if (loneWire) {
    return (
      <InspectorSection id="part" title="Wire">
        <InspectorRow label="Net">
          <InspectorValue tone={wireNet?.name ? "brand" : "muted"}>
            {wireNet?.name ?? "Not connected"}
          </InspectorValue>
        </InspectorRow>
        <InspectorRow label="Pins on net">
          <InspectorValue tone="muted">
            {wireNet?.pins.length ? wireNet.pins.slice(0, 8).join(", ") : "None"}
            {(wireNet?.pins.length ?? 0) > 8 ? " …" : ""}
          </InspectorValue>
        </InspectorRow>
        <InspectorRow label="Length">
          <InspectorValue tone="muted">
            {formatLength(wireLength(loneWire), lengthUnit)}
          </InspectorValue>
        </InspectorRow>
        <InspectorRow label="Corners">
          <InspectorValue tone="muted">{loneWire.points.length - 2}</InspectorValue>
        </InspectorRow>
      </InspectorSection>
    );
  }

  if (total > 1 || selected.length === 0) {
    const counts = [
      selected.length ? plural(selected.length, "part") : null,
      selectedWires.length ? plural(selectedWires.length, "wire") : null,
      selectedLabels.length ? plural(selectedLabels.length, "label") : null,
    ].filter(Boolean);
    return (
      <InspectorSection id="part" title="Selection">
        <InspectorRow label="Items">
          <InspectorValue tone="muted">{counts.join(", ")}</InspectorValue>
        </InspectorRow>
        {selected.length ? (
          <InspectorRow label="Parts">
            <InspectorValue tone="muted">
              {selected
                .map((p) => p.name)
                .slice(0, 6)
                .join(", ")}
              {selected.length > 6 ? " …" : ""}
            </InspectorValue>
          </InspectorRow>
        ) : null}
      </InspectorSection>
    );
  }

  const part = selected[0] as Part;
  const definition = partFor(part.type);
  const symbol = symbolFor(part.type);
  const valueKey = symbol?.value?.key;
  const property = definition?.component?.properties.find(
    (p): p is NumberProperty => p.kind === "number" && p.key === valueKey,
  );
  const rawValue = valueKey ? part.props[valueKey] : undefined;

  return (
    <InspectorSection id="part" title="Part">
      <InspectorRow label="Name">
        {(id) => (
          <CommitField
            key={`${part.id}:${part.name}`}
            id={id}
            label="Part name"
            value={part.name}
            onCommit={(text) => {
              if (!/^[A-Za-z][A-Za-z0-9_]{0,15}$/.test(text)) {
                post(
                  "warning",
                  "A part name starts with a letter, then letters, digits or _ (e.g. R1).",
                );
                return false;
              }
              if (parts.some((p) => p.id !== part.id && p.name === text)) {
                post("warning", `Another part is already named ${text}.`);
              }
              return apply(() => projectEdits.renamePart(part.id, text));
            }}
          />
        )}
      </InspectorRow>
      <InspectorRow label="Type">
        <InspectorValue tone="muted">{definition?.name ?? part.type}</InspectorValue>
      </InspectorRow>
      {property && typeof rawValue === "number" ? (
        <InspectorRow label={property.label}>
          {(id) => (
            <CommitField
              key={`${part.id}:${rawValue}`}
              id={id}
              label={property.label}
              value={formatQuantity(rawValue, property.quantity, 6)}
              onCommit={(text) => {
                const parsed = parseQuantity(text, property.quantity, property);
                if (!parsed.ok) {
                  post("warning", `${part.name}: ${parsed.message}`);
                  return false;
                }
                return apply(() => projectEdits.setPartProp(part.id, property.key, parsed.value));
              }}
            />
          )}
        </InspectorRow>
      ) : null}
      <InspectorRow label="Position">
        <InspectorValue tone="muted">
          {formatLength(part.x, lengthUnit).replace(/ (mm|in)$/, "")},{" "}
          {formatLength(part.y, lengthUnit)}
        </InspectorValue>
      </InspectorRow>
      <InspectorRow label="Orientation">
        <InspectorValue tone="muted">{orientation(part)}</InspectorValue>
      </InspectorRow>
    </InspectorSection>
  );
}
