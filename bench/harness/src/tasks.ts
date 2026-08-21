import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { repositoryRoot } from "./config.js";
import type { BenchmarkTask } from "./types.js";

export async function loadTasks(): Promise<readonly BenchmarkTask[]> {
  const parsed: unknown = JSON.parse(
    await readFile(resolve(repositoryRoot, "bench/tasks.json"), "utf8"),
  );
  if (!Array.isArray(parsed)) throw new TypeError("bench/tasks.json must contain an array.");
  return parsed.map((value) => {
    if (typeof value !== "object" || value === null) throw new TypeError("Invalid benchmark task.");
    const task = value as Partial<BenchmarkTask>;
    if (typeof task.id !== "string" || typeof task.prompt !== "string")
      throw new TypeError("Every benchmark task needs id and prompt strings.");
    return { id: task.id, prompt: task.prompt };
  });
}
