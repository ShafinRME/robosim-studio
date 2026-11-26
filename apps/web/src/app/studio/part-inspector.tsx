"use client";

/**
 * Inspector section for the schematic selection. One part → name, type and **every property of its
 * part file** (ADR 010): numbers with units and ranges, choices, on/off; then position and
 * orientation. Several parts of the same type → the same rows, editing all of them at once ("Mixed"
 * where they differ). Wires and net labels have their own sections. Fields edit on Enter or when
 * they lose focus, Esc puts the current value back; each change is one undoable edit. Values are
 * typed like on real parts ("4k7", "4.7 kΩ", "100n") and checked with a plain-word message.
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
  type DcResult,
  type NetLabel,
  type Part,
  type PartDefinition,
  type PropertyDefinition,
  type ProjectEdit,
  type ProjectStore,
  type Wire,
} from "@robosim/core";
import { Input } from "@robosim/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@robosim/ui/components/select";
import { Switch } from "@robosim/ui/components/switch";
import { InspectorRow, InspectorSection, InspectorValue } from "@robosim/ui/components/inspector";
import { useMemo, useState } from "react";
import { useSchematicPrefs } from "../../lib/schematic-prefs";
import { useDcResults } from "./dc-results";
import { useStudioStatus } from "./studio-status";

/** A text field that commits on Enter / blur and restores on Esc. */
function CommitField({
  id,
  value,
  label,
  placeholder,
  onCommit,
}: {
  id: string;
  value: string;
  label: string;
  placeholder?: string;
  /** Returns false to put the old value back. */
  onCommit: (text: string) => boolean;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <Input
      id={id}
      value={draft}
      placeholder={placeholder}
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

type Apply = (edit: () => ProjectEdit) => boolean;

/** "more than 0 Ω to 1 TΩ": the allowed range, shown as the row tooltip. */
function rangeHint(property: PropertyDefinition): string | undefined {
  if (property.kind !== "number") return undefined;
  const { min, max, quantity } = property;
  if (min === undefined && max === undefined) return undefined;
  const from =
    min === undefined
      ? ""
      : `${property.exclusiveMin ? "more than " : ""}${formatQuantity(min, quantity)}`;
  const to = max === undefined ? "" : formatQuantity(max, quantity);
  return from && to ? `${from} to ${to}` : from ? `at least ${from}` : `at most ${to}`;
}

/**
 * One row per property of the part type, for one part or several of the same type. The part file
 * describes the properties (ADR 010); nothing here is written for a particular part.
 */
function PropertyRows({
  parts,
  definition,
  apply,
}: {
  parts: readonly Part[];
  definition: PartDefinition;
  apply: Apply;
}) {
  const { post } = useStudioStatus();
  const ids = parts.map((p) => p.id);
  const who = parts.length === 1 ? (parts[0]?.name ?? "") : `${parts.length} parts`;
  return (
    <>
      {(definition.component?.properties ?? []).map((property) => {
        const values = parts.map((p) => p.props[property.key] ?? property.default);
        const first = values[0];
        const same = values.every((v) => v === first);
        const set = (value: number | string | boolean) =>
          apply(() => projectEdits.setPartsProp(ids, property.key, value));
        switch (property.kind) {
          case "number":
            return (
              <InspectorRow key={property.key} label={property.label} hint={rangeHint(property)}>
                {(id) => (
                  <CommitField
                    key={`${ids.join()}:${values.join()}`}
                    id={id}
                    label={property.label}
                    value={
                      same && typeof first === "number"
                        ? formatQuantity(first, property.quantity, 6)
                        : ""
                    }
                    placeholder={same ? undefined : "Mixed"}
                    onCommit={(text) => {
                      if (!text) return false;
                      const parsed = parseQuantity(text, property.quantity, property);
                      if (!parsed.ok) {
                        post("warning", `${who}: ${parsed.message}`);
                        return false;
                      }
                      return set(parsed.value);
                    }}
                  />
                )}
              </InspectorRow>
            );
          case "boolean":
            return (
              <InspectorRow key={property.key} label={property.label}>
                {(id) => (
                  <span className="flex items-center gap-2">
                    <Switch
                      id={id}
                      aria-label={property.label}
                      checked={same && first === true}
                      onCheckedChange={(checked) => set(checked)}
                    />
                    <span className="text-xs text-muted-foreground">
                      {same ? (first === true ? "Yes" : "No") : "Mixed"}
                    </span>
                  </span>
                )}
              </InspectorRow>
            );
          case "choice":
            return (
              <InspectorRow key={property.key} label={property.label}>
                {(id) => (
                  <Select
                    value={same && typeof first === "string" ? first : ""}
                    onValueChange={(value) => set(value)}
                  >
                    <SelectTrigger id={id} size="sm" aria-label={property.label}>
                      <SelectValue placeholder="Mixed" />
                    </SelectTrigger>
                    <SelectContent>
                      {property.options.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </InspectorRow>
            );
        }
      })}
    </>
  );
}

/** The part's DC operating point (ADR 011): its voltage, current and power, live. */
function DcRows({ result, partId }: { result: DcResult; partId: string }) {
  // Its own heading, so a result ("Voltage 5 V") is never mistaken for a setting of the same name.
  const heading = (
    <div
      role="heading"
      aria-level={4}
      className="mt-1.5 flex items-center gap-2 border-t pt-2 font-mono text-2xs font-semibold tracking-[0.12em] text-faint-foreground uppercase"
    >
      DC operating point
      <span className="font-normal tracking-normal normal-case">· live</span>
    </div>
  );
  if (!result.ok) {
    return (
      <>
        {heading}
        <InspectorRow label="Result">
          <InspectorValue tone="muted">Not solved (see the DC list)</InspectorValue>
        </InspectorRow>
      </>
    );
  }
  const readouts = result.parts.find((p) => p.id === partId)?.readouts ?? [];
  if (readouts.length === 0) return null; // ground has no results of its own
  return (
    <>
      {heading}
      {readouts.map((r) => (
        <InspectorRow key={r.key} label={r.label} hint="DC operating point (live)">
          <InspectorValue>
            <span data-readout={r.key}>{formatQuantity(r.value, r.quantity, 4)}</span>
          </InspectorValue>
        </InspectorRow>
      ))}
    </>
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
  const { lengthUnit, showDcResults } = useSchematicPrefs();
  const dc = useDcResults(store.getState().project.id);
  const dcResult = showDcResults ? dc.result : null;
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
        {dcResult?.ok && wireNet?.name ? (
          <InspectorRow label="Voltage">
            <InspectorValue>
              {formatQuantity(
                dcResult.nets.find((n) => n.name === wireNet.name)?.voltage ?? Number.NaN,
                "voltage",
                4,
              )}
            </InspectorValue>
          </InspectorRow>
        ) : null}
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

  const sameType =
    selected.length > 1 &&
    total === selected.length &&
    selected.every((p) => p.type === selected[0]?.type)
      ? partFor(selected[0]?.type ?? "")
      : undefined;
  if (sameType) {
    return (
      <InspectorSection id="part" title="Selection" meta={`${selected.length} × ${sameType.name}`}>
        <InspectorRow label="Parts">
          <InspectorValue tone="muted">
            {selected
              .map((p) => p.name)
              .slice(0, 6)
              .join(", ")}
            {selected.length > 6 ? " …" : ""}
          </InspectorValue>
        </InspectorRow>
        <PropertyRows parts={selected} definition={sameType} apply={apply} />
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
      <InspectorRow label="Type" hint={definition?.description}>
        <InspectorValue tone="muted">{definition?.name ?? part.type}</InspectorValue>
      </InspectorRow>
      {definition ? <PropertyRows parts={[part]} definition={definition} apply={apply} /> : null}
      <InspectorRow label="Position">
        <InspectorValue tone="muted">
          {formatLength(part.x, lengthUnit).replace(/ (mm|in)$/, "")},{" "}
          {formatLength(part.y, lengthUnit)}
        </InspectorValue>
      </InspectorRow>
      <InspectorRow label="Orientation">
        <InspectorValue tone="muted">{orientation(part)}</InspectorValue>
      </InspectorRow>
      {dcResult ? <DcRows result={dcResult} partId={part.id} /> : null}
    </InspectorSection>
  );
}
