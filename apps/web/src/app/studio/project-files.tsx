"use client";

import {
  ARCHIVE_EXTENSION,
  ARCHIVE_MIME_TYPE,
  MAX_ARCHIVE_BYTES,
  archiveFileName,
  copyProject,
  createShareToken,
  readArchive,
  readShareToken,
  shareTokenFromHash,
  shareUrl,
  writeArchive,
  type MessageLevel,
  type Project,
} from "@robosim/core";
import { useEffect, useRef, type ReactNode } from "react";

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

/** Copies a link that opens a copy of the project (packed into the link; nothing is uploaded). */
export function copyShareLink(project: Project, post: Post) {
  const result = createShareToken(project);
  if (!result.ok) {
    post("warning", "This project is too large for a link. Export it as a .rsim file instead.");
    return;
  }
  const url = shareUrl(window.location.href, result.token);
  navigator.clipboard.writeText(url).then(
    () =>
      post("success", "Share link copied. Anyone with the link can open a copy of this project."),
    () => post("warning", "The share link could not be copied to the clipboard."),
  );
}

/**
 * Opens a project from a share link (`/studio#share=…`) once the studio is ready, also when a link
 * is pasted into the address bar of an open studio. The link is removed from the address bar
 * afterwards, so a reload does not open it again.
 */
export function useShareLinkOpener(
  ready: boolean,
  open: (project: Project) => boolean,
  post: Post,
) {
  const latest = useRef({ open, post });
  useEffect(() => {
    latest.current = { open, post };
  });

  useEffect(() => {
    if (!ready) return;
    const openFromHash = () => {
      const token = shareTokenFromHash(window.location.hash);
      if (token === null) return;
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      const result = readShareToken(token);
      if (!result.ok) {
        console.warn(`Share link refused (${result.reason}):`, result.issues);
        latest.current.post(
          "warning",
          `This share link could not be opened: ${result.issues[0] ?? result.reason}.`,
        );
        return;
      }
      const project = copyProject(result.project);
      if (latest.current.open(project)) {
        latest.current.post("success", `Opened the shared project “${project.name}”.`);
      }
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, [ready]);
}
