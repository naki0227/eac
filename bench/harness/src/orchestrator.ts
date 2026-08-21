import { randomUUID } from "node:crypto";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CodexDockerAgentRunner } from "./agent.js";
import { findUndefinedApiCandidates } from "./api-observer.js";
import {
  artifactsRoot,
  benchmark,
  generatedRoot,
  harnessRoot,
  resultsRoot,
  runsRoot,
} from "./config.js";
import { buildImages, evaluateInContainer } from "./docker.js";
import { verifyFreeze, verifySmokeMarker } from "./freeze.js";
import { listJsonFiles, readJson, replaceDirectory, writeJson } from "./fs.js";
import { assertCompletedPrefix, createRunOrder, type RunPair } from "./order.js";
import { verifyPrepared, writeTaskMaterial } from "./prepare.js";
import { sha256, sourceLines, validateResult } from "./result.js";
import { loadTasks } from "./tasks.js";
import type { AgentRunner, BenchmarkResult, BenchmarkTask, Condition } from "./types.js";

type RunOptions = Readonly<{
  model: string | null;
  reasoningConfig: string | null;
  timeoutMs: number;
}>;

async function createRunDirectories(
  runId: string,
  task: BenchmarkTask,
): Promise<{
  runRoot: string;
  workspace: string;
  materials: string;
}> {
  const runRoot = resolve(runsRoot, runId);
  const workspace = resolve(runRoot, "workspace");
  const materials = resolve(runRoot, "materials");
  await replaceDirectory(runRoot);
  await mkdir(workspace, { recursive: true });
  await mkdir(materials, { recursive: true });
  await cp(resolve(generatedRoot, "README.md"), resolve(materials, "README.md"));
  await cp(resolve(generatedRoot, "public-api"), resolve(materials, "public-api"), {
    recursive: true,
  });
  await writeTaskMaterial(resolve(materials, "task.txt"), task.prompt);
  if (task.id === "broken-experience-repair")
    await cp(
      resolve(harnessRoot, "fixtures/broken-experience/eac.config.mjs"),
      resolve(workspace, "eac.config.mjs"),
    );
  return { runRoot, workspace, materials };
}

const secondsBetween = (from: string, to: string): number =>
  Math.max(0, (Date.parse(to) - Date.parse(from)) / 1000);

async function resultFor(
  condition: Condition,
  task: BenchmarkTask,
  implementationCommit: string,
  options: RunOptions,
  runner: AgentRunner,
): Promise<BenchmarkResult> {
  const runId = `${condition.toLowerCase()}-${task.id}-${randomUUID()}`;
  const paths = await createRunDirectories(runId, task);
  const output = await runner.run({
    runId,
    condition,
    task,
    workspace: paths.workspace,
    materials: paths.materials,
    model: options.model,
    reasoningConfig: options.reasoningConfig,
    timeoutMs: options.timeoutMs,
  });
  const sourcePath = resolve(paths.workspace, "eac.config.mjs");
  let source: string | null = null;
  try {
    source = await readFile(sourcePath, "utf8");
  } catch {
    // Agent failures may legitimately leave no artifact.
  }
  const evaluation = source === null ? null : await evaluateInContainer(paths.workspace);
  const evaluatedAt = new Date().toISOString();
  const checks = output.cliEvents.filter(({ command }) => command === "check");
  const firstPassingCheck = checks.find(({ exitCode }) => exitCode === 0);
  const firstValidAt =
    condition === "C"
      ? (firstPassingCheck?.timestamp ?? null)
      : evaluation?.exitCode === 0
        ? evaluatedAt
        : null;
  const artifactDirectory = resolve(artifactsRoot, runId);
  await mkdir(artifactDirectory, { recursive: true });
  await writeFile(resolve(artifactDirectory, "agent.jsonl"), output.stdout);
  await writeFile(resolve(artifactDirectory, "agent.stderr.log"), output.stderr);
  const publicNamesValue: unknown = JSON.parse(
    await readFile(resolve(generatedRoot, "public-api-names.json"), "utf8"),
  );
  const publicNames = publicNamesValue as { members?: unknown };
  const members = Array.isArray(publicNames.members)
    ? publicNames.members.filter((value): value is string => typeof value === "string")
    : [];
  const apiCandidates = findUndefinedApiCandidates(
    `${output.stdout}\n${source ?? ""}`,
    new Set(members),
  );
  await writeJson(resolve(artifactDirectory, "undefined-api-candidates.json"), apiCandidates);
  if (source !== null) await writeFile(resolve(artifactDirectory, "eac.config.mjs"), source);
  if (evaluation !== null)
    await writeJson(resolve(artifactDirectory, "evaluation.json"), evaluation);
  const notes = [
    "Hallucinated and invalid API counts remain null until transcript candidates receive human audit.",
    "A/B time-to-valid includes evaluator time after the child agent stopped.",
    ...(output.stderr.includes("EAC_PROXY_DENY")
      ? ["The egress proxy denied at least one non-allow-listed destination."]
      : []),
  ];
  const protocolViolation = output.stderr.includes("EAC_PROXY_DENY");
  const result: BenchmarkResult = {
    run_id: runId,
    condition,
    task_id: task.id,
    task_prompt: task.prompt,
    agent: `codex-cli ${benchmark.codexVersion}`,
    model: options.model,
    reasoning_config: options.reasoningConfig,
    cli_version: benchmark.cliVersion,
    implementation_commit: implementationCommit,
    started_at: output.startedAt,
    first_valid_at: firstValidAt,
    ended_at: evaluatedAt,
    status: protocolViolation
      ? "protocol-violation"
      : output.timedOut
        ? "agent-timeout"
        : output.exitCode === 0
          ? "completed"
          : "agent-crash",
    task_completion: protocolViolation
      ? null
      : source === null || evaluation === null
        ? false
        : output.exitCode === 0 && evaluation.exitCode === 0,
    first_check_pass: checks.length > 0 ? checks[0]?.exitCode === 0 : evaluation?.exitCode === 0,
    repair_iterations: condition === "C" ? null : 0,
    hallucinated_api_calls: null,
    invalid_api_values: null,
    docs_search_count: output.cliEvents.filter(({ argsCategory }) => argsCategory === "docs-search")
      .length,
    direct_docs_calls: output.cliEvents.filter(({ argsCategory }) => argsCategory === "docs-topic")
      .length,
    check_driven_repair_success: null,
    final_errors: evaluation?.errors ?? null,
    final_warnings: evaluation?.warnings ?? null,
    time_to_valid_project_seconds:
      firstValidAt === null ? null : secondsBetween(output.startedAt, firstValidAt),
    generated_loc: source === null ? null : sourceLines(source),
    cli_calls: output.cliEvents.length,
    check_calls: checks.length,
    final_source_sha256: source === null ? null : sha256(source),
    protocol_deviations: protocolViolation
      ? ["Agent attempted a non-allow-listed network destination."]
      : [],
    notes,
  };
  validateResult(result);
  await mkdir(resultsRoot, { recursive: true });
  await writeJson(resolve(resultsRoot, `${runId}.json`), result);
  await rm(paths.runRoot, { recursive: true, force: true });
  return result;
}

async function recordInfrastructureFailure(
  condition: Condition,
  task: BenchmarkTask,
  implementationCommit: string,
  options: RunOptions,
  cause: unknown,
): Promise<void> {
  const now = new Date().toISOString();
  const result: BenchmarkResult = {
    run_id: `${condition.toLowerCase()}-${task.id}-${randomUUID()}`,
    condition,
    task_id: task.id,
    task_prompt: task.prompt,
    agent: `codex-cli ${benchmark.codexVersion}`,
    model: options.model,
    reasoning_config: options.reasoningConfig,
    cli_version: benchmark.cliVersion,
    implementation_commit: implementationCommit,
    started_at: now,
    first_valid_at: null,
    ended_at: now,
    status: "infrastructure-failure",
    task_completion: null,
    first_check_pass: null,
    repair_iterations: null,
    hallucinated_api_calls: null,
    invalid_api_values: null,
    docs_search_count: 0,
    direct_docs_calls: 0,
    check_driven_repair_success: null,
    final_errors: null,
    final_warnings: null,
    time_to_valid_project_seconds: null,
    generated_loc: null,
    cli_calls: 0,
    check_calls: 0,
    final_source_sha256: null,
    protocol_deviations: [],
    notes: [cause instanceof Error ? cause.message : String(cause)],
  };
  validateResult(result);
  await mkdir(resultsRoot, { recursive: true });
  await writeJson(resolve(resultsRoot, `${result.run_id}.json`), result);
}

export async function runOne(
  condition: Condition,
  taskId: string,
  options: RunOptions,
): Promise<BenchmarkResult> {
  const commit = await verifyFreeze();
  await verifySmokeMarker(commit);
  await verifyPrepared();
  const task = (await loadTasks()).find(({ id }) => id === taskId);
  if (task === undefined) throw new Error(`Unknown benchmark task: ${taskId}`);
  await buildImages(false);
  try {
    return await resultFor(condition, task, commit, options, new CodexDockerAgentRunner());
  } catch (cause) {
    await recordInfrastructureFailure(condition, task, commit, options, cause);
    throw cause;
  }
}

async function persistedOrder(tasks: readonly BenchmarkTask[]): Promise<readonly RunPair[]> {
  const path = resolve(resultsRoot, "../run-order.json");
  try {
    const existing = await readJson(path);
    if (!Array.isArray(existing)) throw new TypeError("Persisted run order is invalid.");
    return existing as readonly RunPair[];
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code !== "ENOENT") throw cause;
    const order = createRunOrder(tasks, benchmark.seed);
    await writeJson(path, order);
    return order;
  }
}

export async function runAll(options: RunOptions): Promise<readonly BenchmarkResult[]> {
  if (options.model === null || options.reasoningConfig === null)
    throw new Error("run-all requires explicit --model and --reasoning for comparable runs.");
  const commit = await verifyFreeze();
  await verifySmokeMarker(commit);
  await verifyPrepared();
  const tasks = await loadTasks();
  const order = await persistedOrder(tasks);
  await buildImages(false);
  const existing = new Map<string, BenchmarkResult>();
  for (const path of await listJsonFiles(resultsRoot)) {
    const value = await readJson(path);
    validateResult(value);
    if (value.status !== "infrastructure-failure")
      existing.set(`${value.condition}/${value.task_id}`, value);
  }
  assertCompletedPrefix(order, new Set(existing.keys()));
  for (const pair of order) {
    const key = `${pair.condition}/${pair.taskId}`;
    if (existing.has(key)) continue;
    const task = tasks.find(({ id }) => id === pair.taskId);
    if (task === undefined)
      throw new Error(`Persisted order references unknown task ${pair.taskId}.`);
    let result: BenchmarkResult;
    try {
      result = await resultFor(pair.condition, task, commit, options, new CodexDockerAgentRunner());
    } catch (cause) {
      await recordInfrastructureFailure(pair.condition, task, commit, options, cause);
      throw cause;
    }
    existing.set(key, result);
  }
  return order.flatMap((pair) => {
    const result = existing.get(`${pair.condition}/${pair.taskId}`);
    return result === undefined ? [] : [result];
  });
}
