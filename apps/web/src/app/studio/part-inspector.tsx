"use client";

/**
 * Inspector section for the schematic selection (Day 12): one part → designator, value, position
 * and orientation; several parts → how many. Fields edit on Enter or when they lose focus, Esc puts
 * the current value back; each change is one undoable edit. Values are typed like on real parts
 * ("4k7", "4.7 kΩ", "100n") and checked against the part's range with a plain-word message.
 */
import {
  PLACEABLE_PARTS,
  ProjectEditError,
  formatLength,
  formatQuantity,
  parseQuantity,
  projectEdits,
  symbolFor,
  type NumberProperty,
  type Part,
  type ProjectStore,
} from "@robosim/core";
import { Input } from "@robosim/ui/components/input";
import { InspectorRow, InspectorSection, InspectorValue } from "@robosim/ui/components/inspector";
import { useState } from "react";
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

export function PartInspector({
  store,
  parts,
  selectedIds,
}: {
  store: ProjectStore;
  parts: readonly Part[];
  selectedIds: readonly string[];
}) {
  const { post } = useStudioStatus();
  const { lengthUnit } = useSchematicPrefs();
  const selected = parts.filter((p) => selectedIds.includes(p.id));
  if (selected.length === 0) return null;

  if (selected.length > 1) {
    return (
      <InspectorSection id="part" title="Selection">
        <InspectorRow label="Parts">
          <InspectorValue tone="muted">{selected.length} selected</InspectorValue>
        </InspectorRow>
        <InspectorRow label="Names">
          <InspectorValue tone="muted">
            {selected
              .map((p) => p.name)
              .slice(0, 6)
              .join(", ")}
            {selected.length > 6 ? " …" : ""}
          </InspectorValue>
        </InspectorRow>
      </InspectorSection>
    );
  }

  const part = selected[0] as Part;
  const placeable = PLACEABLE_PARTS.find((p) => p.type === part.type);
  const symbol = symbolFor(part.type);
  const valueKey = symbol?.value?.key;
  const property = placeable?.definition?.properties.find(
    (p): p is NumberProperty => p.kind === "number" && p.key === valueKey,
  );
  const rawValue = valueKey ? part.props[valueKey] : undefined;

  const apply = (edit: () => ReturnType<typeof projectEdits.renamePart>) => {
    try {
      store.getState().apply(edit());
      return true;
    } catch (error) {
      if (!(error instanceof ProjectEditError)) throw error;
      post("warning", error.message);
      return false;
    }
  };

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
        <InspectorValue tone="muted">{placeable?.label ?? part.type}</InspectorValue>
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
