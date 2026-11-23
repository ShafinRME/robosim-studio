/**
 * Project files (ADR 004).
 *
 * A project is what every lab edits: its name, its lab and the parts placed on the canvas. Projects
 * are stored and imported as JSON, so anything read back is untrusted: it is size-checked, parsed,
 * migrated to the current format version and validated with a strict Zod schema before use.
 */
import { z } from "zod";
import { LABS, type LabId } from "./labs";

export const PROJECT_FORMAT = "robosim-project";
/** Current project format version. Bump it together with a migration in `PROJECT_MIGRATIONS`. */
export const PROJECT_VERSION = 1;
/** Project files larger than this are refused before parsing. */
export const MAX_PROJECT_CHARS = 5_000_000;
export const MAX_PROJECT_PARTS = 2_000;
export const MAX_PART_PROPS = 64;
export const MAX_NAME_CHARS = 100;
/** Canvas coordinates are limited to ±this many units. */
export const MAX_COORDINATE = 1_000_000;
const MAX_TEXT_PROP_CHARS = 1_000;
const MAX_REPORTED_ISSUES = 10;

const idSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,64}$/, "must be 1–64 letters, digits, '-' or '_'");
// Bounded, unambiguous pattern: lower-case words joined by single '.' or '-' (no ReDoS).
const partTypeSchema = z
  .string()
  .max(64)
  .regex(
    /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/,
    "must be a part type like 'resistor' or 'sensor.ultrasonic'",
  );
// Keys that could reach an object's prototype are refused outright.
const FORBIDDEN_KEYS: ReadonlySet<string> = new Set(["__proto__", "constructor", "prototype"]);
export const propKeySchema = z
  .string()
  .regex(/^[A-Za-z_][A-Za-z0-9_]{0,63}$/, "must be a property name")
  .refine((key) => !FORBIDDEN_KEYS.has(key), "is a reserved name");
export const propValueSchema = z.union([
  z.number().min(-1e15).max(1e15),
  z.string().max(MAX_TEXT_PROP_CHARS),
  z.boolean(),
]);
export const coordinateSchema = z.number().min(-MAX_COORDINATE).max(MAX_COORDINATE);
const LAB_IDS = LABS.map((lab) => lab.id) as [LabId, ...LabId[]];

export const partSchema = z.strictObject({
  id: idSchema,
  type: partTypeSchema,
  name: z.string().max(MAX_NAME_CHARS),
  x: coordinateSchema,
  y: coordinateSchema,
  /** Degrees, 0 ≤ rotation < 360. */
  rotation: z.number().min(0).lt(360),
  props: z
    .record(propKeySchema, propValueSchema)
    .refine((props) => Object.keys(props).length <= MAX_PART_PROPS, {
      message: `must have at most ${MAX_PART_PROPS} properties`,
    }),
});

export const projectSchema = z
  .strictObject({
    format: z.literal(PROJECT_FORMAT),
    version: z.literal(PROJECT_VERSION),
    id: idSchema,
    name: z.string().trim().min(1).max(MAX_NAME_CHARS),
    lab: z.enum(LAB_IDS).nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    parts: z.array(partSchema).max(MAX_PROJECT_PARTS),
  })
  .superRefine((project, ctx) => {
    const seen = new Set<string>();
    project.parts.forEach((part, index) => {
      if (seen.has(part.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["parts", index, "id"],
          message: `duplicate part id "${part.id}"`,
        });
      }
      seen.add(part.id);
    });
  });

export type PartValue = z.infer<typeof propValueSchema>;
export type Part = z.infer<typeof partSchema>;
export type Project = z.infer<typeof projectSchema>;

/** Upgrades raw project data from format version `n` to `n + 1`. Must be pure. */
export type ProjectMigration = (data: Record<string, unknown>) => Record<string, unknown>;
/** Migration from each old version (key) to the next one. v1 is the first format: none yet. */
export const PROJECT_MIGRATIONS: Readonly<Record<number, ProjectMigration>> = {};

export type ProjectRejection =
  "too-large" | "corrupt" | "not-a-project" | "newer-version" | "migration-failed" | "invalid";

export type ProjectLoadResult =
  | { ok: true; project: Project; /** Version the data was stored in. */ fromVersion: number }
  | { ok: false; reason: ProjectRejection; issues: string[] };

const reject = (reason: ProjectRejection, ...issues: string[]): ProjectLoadResult => ({
  ok: false,
  reason,
  issues,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type MigrationResult =
  | { ok: true; data: Record<string, unknown>; fromVersion: number }
  | { ok: false; reason: "not-a-project" | "newer-version" | "migration-failed"; issue: string };

/**
 * Runs the migration chain on raw data up to `target`. Data from a newer version is refused: the
 * studio never guesses what a future format means.
 */
export function migrateProjectData(
  data: unknown,
  migrations: Readonly<Record<number, ProjectMigration>> = PROJECT_MIGRATIONS,
  target: number = PROJECT_VERSION,
): MigrationResult {
  if (!isRecord(data) || data.format !== PROJECT_FORMAT) {
    return { ok: false, reason: "not-a-project", issue: "not a RoboSim Studio project" };
  }
  const fromVersion = data.version;
  if (typeof fromVersion !== "number" || !Number.isInteger(fromVersion) || fromVersion < 1) {
    return { ok: false, reason: "not-a-project", issue: "version: must be a whole number ≥ 1" };
  }
  if (fromVersion > target) {
    return {
      ok: false,
      reason: "newer-version",
      issue: `made with a newer version of RoboSim Studio (format ${fromVersion}, this one reads up to ${target})`,
    };
  }
  let current = data;
  for (let version = fromVersion; version < target; version++) {
    const migrate = migrations[version];
    if (!migrate) {
      return {
        ok: false,
        reason: "migration-failed",
        issue: `no migration from version ${version}`,
      };
    }
    try {
      const next = migrate(current);
      if (!isRecord(next)) throw new Error("migration did not return an object");
      current = { ...next, format: PROJECT_FORMAT, version: version + 1 };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        reason: "migration-failed",
        issue: `migration ${version} → ${version + 1} failed: ${message}`,
      };
    }
  }
  return { ok: true, data: current, fromVersion };
}

function describeIssues(error: z.ZodError): string[] {
  return error.issues
    .slice(0, MAX_REPORTED_ISSUES)
    .map((issue) => `${issue.path.length ? issue.path.join(".") : "(project)"}: ${issue.message}`);
}

/** Migrates and validates already-parsed project data (e.g. from storage). */
export function loadProject(
  data: unknown,
  migrations: Readonly<Record<number, ProjectMigration>> = PROJECT_MIGRATIONS,
): ProjectLoadResult {
  const migrated = migrateProjectData(data, migrations);
  if (!migrated.ok) return reject(migrated.reason, migrated.issue);
  const parsed = projectSchema.safeParse(migrated.data);
  if (!parsed.success) return reject("invalid", ...describeIssues(parsed.error));
  return { ok: true, project: parsed.data, fromVersion: migrated.fromVersion };
}

/** Checks, parses, migrates and validates a project file's text. */
export function parseProject(
  text: string,
  migrations: Readonly<Record<number, ProjectMigration>> = PROJECT_MIGRATIONS,
): ProjectLoadResult {
  if (text.length > MAX_PROJECT_CHARS) {
    return reject("too-large", `larger than ${MAX_PROJECT_CHARS.toLocaleString("en")} characters`);
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return reject("corrupt", "not valid JSON");
  }
  return loadProject(data, migrations);
}

/** Project file text (pretty-printed, so files diff well in version control). */
export function serializeProject(project: Project): string {
  return `${JSON.stringify(project, null, 2)}\n`;
}

/** A random id for projects and parts (not a secret). */
export function newId(random: () => number = Math.random): string {
  const uuid = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID?.();
  if (uuid) return uuid;
  let id = "";
  for (let i = 0; i < 20; i++) id += Math.floor(random() * 36).toString(36);
  return id;
}

/** A new, empty project in the current format. */
export function createProject(options: {
  name: string;
  lab?: LabId | null;
  id?: string;
  now?: Date;
}): Project {
  const time = (options.now ?? new Date()).toISOString();
  return projectSchema.parse({
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    id: options.id ?? newId(),
    name: options.name,
    lab: options.lab ?? null,
    createdAt: time,
    updatedAt: time,
    parts: [],
  });
}

/**
 * The same project under a new id, for imported files and shared links: an import never
 * overwrites a project that is already saved.
 */
export function copyProject(project: Project, id: string = newId()): Project {
  return projectSchema.parse({ ...project, id });
}
