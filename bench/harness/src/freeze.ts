import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { benchmark, repositoryRoot, smokeMarker } from "./config.js";
import { requireSuccess } from "./process.js";

export function assertExpectedCommit(actual: string, expected: string): void {
  if (actual !== expected)
    throw new Error(`Benchmark commit mismatch: expected ${expected}, received ${actual}.`);
}

export async function currentCommit(): Promise<string> {
  return requireSuccess("git", ["rev-parse", "HEAD"], repositoryRoot);
}

export async function verifyFreeze(): Promise<string> {
  const expected = await requireSuccess(
    "git",
    ["rev-list", "-n", "1", benchmark.freezeTag],
    repositoryRoot,
  ).catch(() => {
    throw new Error(`Missing required freeze tag ${benchmark.freezeTag}.`);
  });
  const actual = await currentCommit();
  assertExpectedCommit(actual, expected);
  const status = await requireSuccess(
    "git",
    ["status", "--porcelain", "--untracked-files=all"],
    repositoryRoot,
  );
  if (status.length > 0) throw new Error("Benchmark working tree is dirty; refusing to run.");
  return expected;
}

export async function verifySmokeMarker(commit: string): Promise<void> {
  const parsed = JSON.parse(await readFile(resolve(smokeMarker), "utf8")) as {
    implementationCommit?: unknown;
    passed?: unknown;
  };
  if (parsed.passed !== true || parsed.implementationCommit !== commit)
    throw new Error("Smoke checks have not passed for the frozen commit.");
}
