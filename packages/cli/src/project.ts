import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { ExperienceIR } from "@eac/ir";

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
  if (path.endsWith(".json")) {
    const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
    if (!isExperience(parsed)) throw new TypeError("JSON does not contain EaC v0.2 IR.");
    return parsed;
  }
  const module: unknown = await import(`${pathToFileURL(path).href}?t=${Date.now()}`);
  const exported =
    typeof module === "object" && module !== null && "default" in module
      ? module.default
      : undefined;
  if (isBuildable(exported)) return exported.build();
  if (isExperience(exported)) return exported;
  throw new TypeError("Project must default-export an ExperienceBuilder or ExperienceIR.");
}
