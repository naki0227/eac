import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { authPreflightMarker, benchmark, repositoryRoot, smokeMarker } from "./config.js";
import { requireSuccess } from "./process.js";
import { sha256 } from "./result.js";

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
  const parsed = await readMarker(smokeMarker, "Smoke checks");
  assertPassedMarker(parsed, commit, "Smoke checks");
}

async function readMarker(path: string, label: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(resolve(path), "utf8")) as unknown;
  } catch {
    throw new Error(`${label} has not passed for the frozen commit.`);
  }
}

export function assertPassedMarker(value: unknown, commit: string, label: string): void {
  if (typeof value !== "object" || value === null)
    throw new Error(`${label} has not passed for the frozen commit.`);
  const marker = value as { implementationCommit?: unknown; passed?: unknown };
  if (marker.passed !== true || marker.implementationCommit !== commit)
    throw new Error(`${label} has not passed for the frozen commit.`);
}

export async function verifyAuthPreflightMarker(commit: string): Promise<void> {
  assertAuthPreflightMarker(
    await readMarker(authPreflightMarker, "Auth transport preflight"),
    commit,
  );
}

export function assertAuthPreflightMarker(value: unknown, commit: string): void {
  assertPassedMarker(value, commit, "Auth transport preflight");
  const marker = value as {
    authentication?: unknown;
    responseSha256?: unknown;
    exposedMaterials?: unknown;
  };
  if (
    marker.authentication !== "chatgpt" ||
    marker.responseSha256 !== sha256("BENCH_AUTH_OK") ||
    !Array.isArray(marker.exposedMaterials) ||
    marker.exposedMaterials.length !== 1 ||
    marker.exposedMaterials[0] !== "task.txt"
  )
    throw new Error("Auth transport preflight evidence is invalid.");
}
