"use client";

import {
  ARCHIVE_EXTENSION,
  ARCHIVE_MIME_TYPE,
  MAX_ARCHIVE_BYTES,
  archiveFileName,
  copyProject,
  readArchive,
  writeArchive,
  type MessageLevel,
  type Project,
} from "@robosim/core";
import { useRef, type ReactNode } from "react";

type Post = (level: MessageLevel, text: string) => void;

/** Downloads a project as a `.rsim` file. */
export function exportProject(project: Project, post: Post) {
  const name = archiveFileName(project);
  const bytes = writeArchive(project);
  // A fresh copy is backed by a plain ArrayBuffer, which is what Blob accepts.
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: ARCHIVE_MIME_TYPE }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  // Give the browser time to start the download before the address is released.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  post("success", `Exported “${project.name}” as ${name}.`);
}

/** File names come from the user's disk: show at most this much of one. */
const shortName = (name: string) => (name.length > 60 ? `${name.slice(0, 57)}…` : name);

/**
 * Import of `.rsim` files: a hidden file input and a function that opens the file picker.
 * An imported project always gets a new id, so it never overwrites a saved project.
 */
export function useProjectImport(
  open: (project: Project) => boolean,
  post: Post,
): { pick: () => void; input: ReactNode } {
  const ref = useRef<HTMLInputElement>(null);

  const importFile = async (file: File) => {
    if (file.size > MAX_ARCHIVE_BYTES) {
      post("warning", `“${shortName(file.name)}” is too large to be a RoboSim Studio project.`);
      return;
    }
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await file.arrayBuffer());
    } catch {
      post("error", `“${shortName(file.name)}” could not be read.`);
      return;
    }
    const result = readArchive(bytes);
    if (!result.ok) {
      console.warn(`Import of ${file.name} refused (${result.reason}):`, result.issues);
      post(
        "warning",
        `“${shortName(file.name)}” could not be imported: ${result.issues[0] ?? result.reason}.`,
      );
      return;
    }
    const project = copyProject(result.project);
    if (open(project)) post("success", `Imported “${project.name}”.`);
  };

  return {
    pick: () => ref.current?.click(),
    input: (
      <input
        ref={ref}
        type="file"
        accept={`${ARCHIVE_EXTENSION},${ARCHIVE_MIME_TYPE},application/zip`}
        className="hidden"
        aria-hidden
        tabIndex={-1}
        data-testid="import-project-input"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = ""; // the same file can be picked again
          if (file) void importFile(file);
        }}
      />
    ),
  };
}
