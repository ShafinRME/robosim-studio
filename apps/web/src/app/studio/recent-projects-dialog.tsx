"use client";

import { LABS, type MessageLevel } from "@robosim/core";
import { Button } from "@robosim/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@robosim/ui/components/dialog";
import { FolderOpen, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ProjectSummary } from "../../lib/project-db";

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const labName = (id: string | null) => LABS.find((lab) => lab.id === id)?.name ?? "No lab yet";

/**
 * "Recent projects" window: every project saved in this browser, newest first. Open one, or delete
 * one for good (after a second click to confirm).
 */
export function RecentProjectsDialog({
  open,
  onOpenChange,
  openIds,
  listSaved,
  openSaved,
  deleteSaved,
  post,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Projects open in a tab right now. */
  openIds: ReadonlySet<string>;
  listSaved: () => Promise<ProjectSummary[]>;
  openSaved: (id: string) => Promise<boolean>;
  deleteSaved: (id: string) => Promise<boolean>;
  post: (level: MessageLevel, text: string) => void;
}) {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const latestList = useRef(listSaved);
  useEffect(() => {
    latestList.current = listSaved;
  });

  // Read the list each time the window opens (it changes as projects are edited).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void latestList.current().then((list) => {
      if (!cancelled) setProjects(list);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const close = (next: boolean) => {
    if (!next) {
      setProjects(null);
      setConfirmId(null);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Recent projects</DialogTitle>
          <DialogDescription>
            Projects saved in this browser on this computer. Export a project to keep a copy
            elsewhere.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto px-2 py-2">
          {projects === null ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">Loading…</p>
          ) : projects.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              No saved projects yet.
            </p>
          ) : (
            <ul aria-label="Saved projects" className="flex flex-col">
              {projects.map((project) => {
                const isOpen = openIds.has(project.id);
                const confirming = confirmId === project.id;
                return (
                  <li
                    key={project.id}
                    className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-surface-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">{project.name}</p>
                      <p className="font-mono text-2xs text-faint-foreground">
                        {labName(project.lab)} · {project.partCount}{" "}
                        {project.partCount === 1 ? "part" : "parts"} · changed{" "}
                        {dateFormat.format(new Date(project.updatedAt))}
                        {isOpen ? " · open" : ""}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`Open ${project.name}`}
                      onClick={() => {
                        void openSaved(project.id).then((ok) => {
                          if (ok) close(false);
                        });
                      }}
                    >
                      <FolderOpen /> Open
                    </Button>
                    <Button
                      size="sm"
                      variant={confirming ? "danger" : "ghost"}
                      aria-label={
                        confirming ? `Confirm: delete ${project.name}` : `Delete ${project.name}`
                      }
                      onClick={() => {
                        if (!confirming) return setConfirmId(project.id);
                        setConfirmId(null);
                        void deleteSaved(project.id).then((ok) => {
                          if (!ok) return;
                          setProjects((list) => list?.filter((p) => p.id !== project.id) ?? null);
                          post("info", `Deleted “${project.name}”.`);
                        });
                      }}
                    >
                      <Trash2 /> {confirming ? "Delete for good?" : "Delete"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
