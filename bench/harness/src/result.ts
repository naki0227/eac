import { createHash } from "node:crypto";
import type { BenchmarkResult, CliEvent, Evaluation } from "./types.js";

export function sha256(source: string): string {
  return createHash("sha256").update(source).digest("hex");
}

export function sourceLines(source: string): number {
  if (source.length === 0) return 0;
  return source.endsWith("\n") ? source.split("\n").length - 1 : source.split("\n").length;
}

export function parseEvaluation(exitCode: number, stdout: string, stderr: string): Evaluation {
  const match = /(\d+) errors, (\d+) warnings\s*$/m.exec(stdout);
  return {
    exitCode,
    errors: match?.[1] === undefined ? null : Number.parseInt(match[1], 10),
    warnings: match?.[2] === undefined ? null : Number.parseInt(match[2], 10),
    stdout,
    stderr,
  };
}

export function parseCliEvents(logs: string): readonly CliEvent[] {
  return logs
    .split("\n")
    .filter((line) => line.startsWith("EAC_CLI_EVENT "))
    .flatMap((line) => {
      try {
        const value: unknown = JSON.parse(line.slice("EAC_CLI_EVENT ".length));
        if (typeof value !== "object" || value === null) return [];
        const event = value as Partial<CliEvent>;
        if (
          typeof event.timestamp !== "string" ||
          typeof event.command !== "string" ||
          typeof event.argsCategory !== "string" ||
          typeof event.exitCode !== "number"
        )
          return [];
        return [event as CliEvent];
      } catch {
        return [];
      }
    });
}

export function validateResult(value: unknown): asserts value is BenchmarkResult {
  if (typeof value !== "object" || value === null) throw new TypeError("Result must be an object.");
  const result = value as Partial<BenchmarkResult>;
  for (const key of [
    "run_id",
    "task_id",
    "task_prompt",
    "agent",
    "cli_version",
    "implementation_commit",
    "started_at",
    "ended_at",
  ] as const)
    if (typeof result[key] !== "string") throw new TypeError(`${key} must be a string.`);
  if (result.condition !== "A" && result.condition !== "B" && result.condition !== "C")
    throw new TypeError("condition must be A, B, or C.");
  if (
    result.status !== "completed" &&
    result.status !== "agent-timeout" &&
    result.status !== "agent-crash" &&
    result.status !== "infrastructure-failure" &&
    result.status !== "protocol-violation"
  )
    throw new TypeError("status is invalid.");
  for (const key of ["model", "reasoning_config", "first_valid_at", "final_source_sha256"] as const)
    if (result[key] !== null && typeof result[key] !== "string")
      throw new TypeError(`${key} must be a string or null.`);
  for (const key of ["task_completion", "first_check_pass", "check_driven_repair_success"] as const)
    if (result[key] !== null && typeof result[key] !== "boolean")
      throw new TypeError(`${key} must be a boolean or null.`);
  for (const key of [
    "repair_iterations",
    "hallucinated_api_calls",
    "invalid_api_values",
    "final_errors",
    "final_warnings",
    "time_to_valid_project_seconds",
    "generated_loc",
  ] as const)
    if (result[key] !== null && (typeof result[key] !== "number" || (result[key] ?? -1) < 0))
      throw new TypeError(`${key} must be a non-negative number or null.`);
  const deviations: unknown = result.protocol_deviations;
  const notes: unknown = result.notes;
  if (!Array.isArray(deviations) || !Array.isArray(notes))
    throw new TypeError("protocol_deviations and notes must be arrays.");
  if (
    !deviations.every((item: unknown) => typeof item === "string") ||
    !notes.every((item: unknown) => typeof item === "string")
  )
    throw new TypeError("protocol_deviations and notes must contain strings.");
  for (const key of ["docs_search_count", "direct_docs_calls", "cli_calls", "check_calls"] as const)
    if (!Number.isInteger(result[key]) || (result[key] ?? -1) < 0)
      throw new TypeError(`${key} must be a non-negative integer.`);
}

export type ConditionSummary = Readonly<{
  condition: "A" | "B" | "C";
  runs: number;
  completed: number;
  taskCompletion: number;
  hallucinatedApiCalls: number | null;
  docsSearches: number;
  directDocsCalls: number;
  checkCalls: number;
  finalErrors: number;
  finalWarnings: number;
}>;

export function summarize(results: readonly BenchmarkResult[]): readonly ConditionSummary[] {
  return (["A", "B", "C"] as const).map((condition) => {
    const runs = results.filter((result) => result.condition === condition);
    const observedHallucinations = runs.map((run) => run.hallucinated_api_calls);
    return {
      condition,
      runs: runs.length,
      completed: runs.filter((run) => run.status === "completed").length,
      taskCompletion: runs.filter((run) => run.task_completion === true).length,
      hallucinatedApiCalls:
        observedHallucinations.length === 0 ||
        observedHallucinations.some((value) => value === null)
          ? null
          : observedHallucinations.reduce<number>((total, value) => total + (value ?? 0), 0),
      docsSearches: runs.reduce((total, run) => total + run.docs_search_count, 0),
      directDocsCalls: runs.reduce((total, run) => total + run.direct_docs_calls, 0),
      checkCalls: runs.reduce((total, run) => total + run.check_calls, 0),
      finalErrors: runs.reduce((total, run) => total + (run.final_errors ?? 0), 0),
      finalWarnings: runs.reduce((total, run) => total + (run.final_warnings ?? 0), 0),
    };
  });
}
