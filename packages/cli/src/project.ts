import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { ExperienceIR } from "@eac/ir";
import { resolveProjectAssets } from "./assets.js";

type Buildable = Readonly<{ build: () => ExperienceIR }>;

const isBuildable = (value: unknown): value is Buildable =>
  typeof value === "object" &&
  value !== null &&
  "build" in value &&
  typeof (value as { build?: unknown }).build === "function";
const isExperience = (value: unknown): value is ExperienceIR =>
  typeof value === "object" &&
  value !== null &&
  "version" in value &&
  (value as { version?: unknown }).version === "0.2" &&
  "scenes" in value;

function assertExperience(value: unknown, source: string): asserts value is ExperienceIR {
  if (isExperience(value)) return;
  const version =
    typeof value === "object" && value !== null && "version" in value
      ? (value as { version?: unknown }).version
      : undefined;
  if (version === "0.1")
    throw new TypeError(
      `${source} contains serialized EaC v0.1 IR. v0.1 IR is never read as v0.2; rebuild it from a v0.2 TypeScript source instead.`,
    );
  throw new TypeError(`${source} does not contain EaC v0.2 IR (found version ${String(version)}).`);
}

export async function findProject(explicit?: string): Promise<string> {
  if (explicit !== undefined) return resolve(explicit);
  for (const candidate of ["eac.config.mjs", "eac.json"]) {
    const path = resolve(candidate);
    try {
      await access(path);
      return path;
    } catch {
      /* continue */
    }
  }
  throw new Error("No EaC project found. Pass a file or run `eac init`.");
}

export async function loadProject(path: string): Promise<ExperienceIR> {
  let experience: ExperienceIR;
  if (path.endsWith(".json")) {
    const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
    assertExperience(parsed, path);
    experience = parsed;
  } else {
    const module: unknown = await import(`${pathToFileURL(path).href}?t=${Date.now()}`);
    const exported =
      typeof module === "object" && module !== null && "default" in module
        ? module.default
        : undefined;
    if (isBuildable(exported)) experience = exported.build();
    else if (isExperience(exported)) experience = exported;
    else throw new TypeError("Project must default-export an ExperienceBuilder or ExperienceIR.");
  }
  return resolveProjectAssets(experience, dirname(path));
}
