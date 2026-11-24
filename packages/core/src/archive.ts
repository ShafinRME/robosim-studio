/**
 * `.rsim` project files (ADR 005): a zip with `manifest.json` and `project.json`.
 *
 * Files come from anywhere, so reading one is defensive: the file size is capped, only known entry
 * names are accepted, and every entry is inflated as a stream while its real size is counted — the
 * sizes written inside the zip are never trusted (zip bombs). The project is then migrated and
 * validated by `parseProject`.
 */
import { Unzip, UnzipInflate, strFromU8, strToU8, zipSync, type UnzipFile } from "fflate";
import { APP_VERSION } from "./app";
import {
  MAX_PROJECT_CHARS,
  parseProject,
  serializeProject,
  type Project,
  type ProjectLoadResult,
  type ProjectRejection,
} from "./project";

export const ARCHIVE_FORMAT = "robosim-archive";
export const ARCHIVE_VERSION = 1;
export const ARCHIVE_EXTENSION = ".rsim";
export const ARCHIVE_MIME_TYPE = "application/vnd.robosim.project+zip";
/** `.rsim` files larger than this are refused before reading. */
export const MAX_ARCHIVE_BYTES = 10 * 1024 * 1024;
/** Real (decompressed) size limits, counted while inflating. */
export const MAX_ENTRY_BYTES = MAX_PROJECT_CHARS;
export const MAX_ARCHIVE_TOTAL_BYTES = 20 * 1024 * 1024;
export const MAX_ARCHIVE_ENTRIES = 16;
const MAX_MANIFEST_BYTES = 4 * 1024;

const MANIFEST = "manifest.json";
const PROJECT = "project.json";
const KNOWN_ENTRIES: ReadonlySet<string> = new Set([MANIFEST, PROJECT]);
const ENTRY_LIMITS: Readonly<Record<string, number>> = {
  [MANIFEST]: MAX_MANIFEST_BYTES,
  [PROJECT]: MAX_ENTRY_BYTES,
};
/** Fixed timestamp, so the same project always gives the same file. */
const ZIP_TIME = new Date("2026-01-01T00:00:00Z");

export type ArchiveRejection =
  ProjectRejection | "not-an-archive" | "unknown-entry" | "missing-entry" | "too-many-entries";

export type ArchiveReadResult =
  | Extract<ProjectLoadResult, { ok: true }>
  | { ok: false; reason: ArchiveRejection; issues: string[] };

const reject = (reason: ArchiveRejection, issue: string): ArchiveReadResult => ({
  ok: false,
  reason,
  issues: [issue],
});

/** Writes a project as `.rsim` file bytes. */
export function writeArchive(project: Project): Uint8Array {
  const manifest = {
    format: ARCHIVE_FORMAT,
    version: ARCHIVE_VERSION,
    app: { name: "RoboSim Studio", version: APP_VERSION },
  };
  return zipSync(
    {
      [MANIFEST]: [strToU8(`${JSON.stringify(manifest, null, 2)}\n`), { level: 0 }],
      [PROJECT]: strToU8(serializeProject(project)),
    },
    { level: 6, mtime: ZIP_TIME },
  );
}

class ArchiveError extends Error {
  constructor(
    readonly reason: ArchiveRejection,
    message: string,
  ) {
    super(message);
  }
}

/** Inflates the known entries with real-size limits. Throws `ArchiveError`. */
function extract(bytes: Uint8Array): Map<string, Uint8Array> {
  const chunks = new Map<string, Uint8Array[]>();
  const sizes = new Map<string, number>();
  let entries = 0;
  let total = 0;
  let failure: ArchiveError | null = null;
  const fail = (error: ArchiveError, file?: UnzipFile) => {
    failure ??= error;
    file?.terminate();
  };

  const unzip = new Unzip((file) => {
    if (failure) return;
    entries++;
    if (entries > MAX_ARCHIVE_ENTRIES) {
      return fail(new ArchiveError("too-many-entries", `more than ${MAX_ARCHIVE_ENTRIES} entries`));
    }
    // Folders are allowed and ignored; any other unknown file is refused.
    if (file.name.endsWith("/")) return;
    if (!KNOWN_ENTRIES.has(file.name) || chunks.has(file.name)) {
      return fail(
        new ArchiveError("unknown-entry", `unexpected entry "${file.name.slice(0, 80)}"`),
      );
    }
    const limit = ENTRY_LIMITS[file.name] ?? 0;
    const parts: Uint8Array[] = [];
    chunks.set(file.name, parts);
    sizes.set(file.name, 0);
    file.ondata = (error, chunk) => {
      if (failure) return;
      if (error) return fail(new ArchiveError("corrupt", "an entry could not be read"), file);
      const size = (sizes.get(file.name) ?? 0) + chunk.length;
      total += chunk.length;
      if (size > limit || total > MAX_ARCHIVE_TOTAL_BYTES) {
        return fail(new ArchiveError("too-large", `"${file.name}" is too large`), file);
      }
      sizes.set(file.name, size);
      parts.push(chunk);
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  try {
    // Feed in slices, so a limit stops the work early instead of after inflating everything.
    const SLICE = 64 * 1024;
    for (let offset = 0; offset < bytes.length && !failure; offset += SLICE) {
      unzip.push(bytes.subarray(offset, offset + SLICE), offset + SLICE >= bytes.length);
    }
  } catch {
    fail(new ArchiveError("corrupt", "not a valid zip file"));
  }
  if (failure) throw failure;

  const files = new Map<string, Uint8Array>();
  for (const [name, parts] of chunks) {
    const out = new Uint8Array(sizes.get(name) ?? 0);
    let offset = 0;
    for (const part of parts) {
      out.set(part, offset);
      offset += part.length;
    }
    files.set(name, out);
  }
  return files;
}

function readManifest(bytes: Uint8Array): ArchiveError | null {
  let manifest: unknown;
  try {
    manifest = JSON.parse(strFromU8(bytes));
  } catch {
    return new ArchiveError("corrupt", "manifest.json is not valid JSON");
  }
  if (typeof manifest !== "object" || manifest === null) {
    return new ArchiveError("not-an-archive", "manifest.json is not an object");
  }
  const { format, version } = manifest as Record<string, unknown>;
  if (format !== ARCHIVE_FORMAT) {
    return new ArchiveError("not-an-archive", "not a RoboSim Studio file");
  }
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    return new ArchiveError("not-an-archive", "manifest.json: bad version");
  }
  if (version > ARCHIVE_VERSION) {
    return new ArchiveError("newer-version", "made with a newer version of RoboSim Studio");
  }
  return null;
}

const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04];

/** Reads `.rsim` file bytes: size check, safe unzip, manifest check, then `parseProject`. */
export function readArchive(bytes: Uint8Array): ArchiveReadResult {
  if (bytes.length > MAX_ARCHIVE_BYTES) {
    return reject("too-large", `larger than ${MAX_ARCHIVE_BYTES / 1024 / 1024} MB`);
  }
  if (!ZIP_SIGNATURE.every((byte, i) => bytes[i] === byte)) {
    return reject("not-an-archive", "not a RoboSim Studio file");
  }
  let files: Map<string, Uint8Array>;
  try {
    files = extract(bytes);
  } catch (error) {
    if (error instanceof ArchiveError) return reject(error.reason, error.message);
    return reject("corrupt", "not a valid zip file");
  }
  const manifest = files.get(MANIFEST);
  if (!manifest) return reject("missing-entry", "manifest.json is missing");
  const manifestError = readManifest(manifest);
  if (manifestError) return reject(manifestError.reason, manifestError.message);
  const project = files.get(PROJECT);
  if (!project) return reject("missing-entry", "project.json is missing");

  let text: string;
  try {
    text = strFromU8(project);
  } catch {
    return reject("corrupt", "project.json is not text");
  }
  const result = parseProject(text);
  return result.ok ? result : { ok: false, reason: result.reason, issues: result.issues };
}

/** File name for a project: its name made safe for every operating system, plus `.rsim`. */
export function archiveFileName(project: Pick<Project, "name">): string {
  const base = project.name
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60)
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `${base || "project"}${ARCHIVE_EXTENSION}`;
}
