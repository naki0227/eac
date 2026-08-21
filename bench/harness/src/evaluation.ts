import { copyFile, mkdir, rm } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { parseEvaluation } from "./result.js";
import { runCommand } from "./process.js";
import type { Evaluation } from "./types.js";

const applicationRoot = process.env.EAC_APPLICATION_ROOT ?? "/app";
const cliPath = resolve(applicationRoot, "packages/cli/dist/bin.js");

export async function evaluateProject(projectPath: string): Promise<Evaluation> {
  if (basename(projectPath) !== "eac.config.mjs")
    return parseEvaluation(1, "", "Only eac.config.mjs may be evaluated.");
  const directory = resolve(applicationRoot, "packages/core/.evaluation", randomUUID());
  const isolatedProject = resolve(directory, "eac.config.mjs");
  await mkdir(directory, { recursive: true });
  try {
    await copyFile(projectPath, isolatedProject);
    const result = await runCommand("node", [cliPath, "check", "--ci", isolatedProject], {
      cwd: applicationRoot,
      timeoutMs: 60_000,
    });
    return parseEvaluation(result.exitCode, result.stdout, result.stderr);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
