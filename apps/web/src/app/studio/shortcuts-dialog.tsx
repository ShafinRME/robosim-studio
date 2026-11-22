"use client";

import type { Command, ShortcutMap } from "@robosim/core";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@robosim/ui/components/dialog";
import { Kbd, KbdGroup } from "@robosim/ui/components/kbd";

/** "Keyboard shortcuts" window: every command that has keys, grouped by menu. */
export function ShortcutsDialog({
  open,
  onOpenChange,
  commands,
  shortcuts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: readonly Command[];
  shortcuts: ShortcutMap;
}) {
  const groups = new Map<string, { command: Command; keys: string[] }[]>();
  for (const command of commands) {
    const keys = shortcuts.keysFor(command.id);
    if (!keys) continue;
    const list = groups.get(command.category) ?? [];
    list.push({ command, keys });
    groups.set(command.category, list);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            While typing in a text box, only shortcuts with {shortcuts.keysFor("palette.open")?.[0]}{" "}
            work.
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto px-4 py-2">
          {[...groups].map(([category, items]) => (
            <section key={category} aria-label={category} className="py-2">
              <h3 className="pb-1 font-mono text-2xs tracking-wider text-faint-foreground uppercase">
                {category}
              </h3>
              <dl>
                {items.map(({ command, keys }) => (
                  <div
                    key={command.id}
                    className="flex h-7 items-center justify-between gap-4 text-xs"
                  >
                    <dt>{command.title}</dt>
                    <dd>
                      <KbdGroup>
                        {keys.map((key) => (
                          <Kbd key={key}>{key}</Kbd>
                        ))}
                      </KbdGroup>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
