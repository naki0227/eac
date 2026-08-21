import { mkdir, open, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { artifactsRoot, auditedResultsRoot, auditsRoot, resultsRoot } from "./config.js";
import { readJson, writeJson } from "./fs.js";
import { sha256, validateResult } from "./result.js";
import type { BenchmarkResult } from "./types.js";

type AuditedMetrics = Readonly<{
  hallucinated_api_calls: number | null;
  invalid_api_values: number | null;
  repair_iterations: number | null;
  check_driven_repair_success: boolean | null;
}>;

export type HumanAudit = Readonly<{
  schema_version: 1;
  run_id: string;
  raw_result_sha256: string;
  auditor: string | null;
  audited_at: string | null;
  metrics: AuditedMetrics;
  evidence_notes: readonly string[];
}>;

const emptyMetrics = (): AuditedMetrics => ({
  hallucinated_api_calls: null,
  invalid_api_values: null,
  repair_iterations: null,
  check_driven_repair_success: null,
});

export function createAuditTemplate(result: BenchmarkResult, rawResultSha256: string): HumanAudit {
  return {
    schema_version: 1,
    run_id: result.run_id,
    raw_result_sha256: rawResultSha256,
    auditor: null,
    audited_at: null,
    metrics: emptyMetrics(),
    evidence_notes: [],
  };
}

function requiredCount(value: unknown, name: string): number {
  if (!Number.isInteger(value) || (value as number) < 0)
    throw new TypeError(`${name} must be a reviewed non-negative integer.`);
  return value as number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireExactKeys(value: Record<string, unknown>, keys: readonly string[], name: string) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw new TypeError(`${name} contains missing or unknown fields.`);
}

function validatedAudit(value: unknown): HumanAudit {
  if (!isRecord(value)) throw new TypeError("Audit must be an object.");
  requireExactKeys(
    value,
    [
      "schema_version",
      "run_id",
      "raw_result_sha256",
      "auditor",
      "audited_at",
      "metrics",
      "evidence_notes",
    ],
    "Audit",
  );
  const audit = value;
  if (audit.schema_version !== 1) throw new TypeError("schema_version must be 1.");
  if (typeof audit.run_id !== "string" || audit.run_id.length === 0)
    throw new TypeError("run_id must be a string.");
  if (
    typeof audit.raw_result_sha256 !== "string" ||
    !/^[0-9a-f]{64}$/.test(audit.raw_result_sha256)
  )
    throw new TypeError("raw_result_sha256 must be a SHA-256 hash.");
  if (typeof audit.auditor !== "string" || audit.auditor.trim().length === 0)
    throw new TypeError("auditor must identify the human reviewer.");
  if (typeof audit.audited_at !== "string" || !Number.isFinite(Date.parse(audit.audited_at)))
    throw new TypeError("audited_at must be an ISO date-time string.");
  if (new Date(audit.audited_at).toISOString() !== audit.audited_at)
    throw new TypeError("audited_at must use canonical ISO date-time format.");
  if (!isRecord(audit.metrics)) throw new TypeError("metrics must be an object.");
  requireExactKeys(
    audit.metrics,
    [
      "hallucinated_api_calls",
      "invalid_api_values",
      "repair_iterations",
      "check_driven_repair_success",
    ],
    "metrics",
  );
  const metrics = audit.metrics;
  const hallucinatedApiCalls = requiredCount(
    metrics.hallucinated_api_calls,
    "hallucinated_api_calls",
  );
  const invalidApiValues = requiredCount(metrics.invalid_api_values, "invalid_api_values");
  const repairIterations = requiredCount(metrics.repair_iterations, "repair_iterations");
  if (typeof metrics.check_driven_repair_success !== "boolean")
    throw new TypeError("check_driven_repair_success must be a reviewed boolean.");
  if (
    !Array.isArray(audit.evidence_notes) ||
    audit.evidence_notes.length === 0 ||
    !audit.evidence_notes.every((note) => typeof note === "string" && note.length > 0)
  )
    throw new TypeError("evidence_notes must contain at least one non-empty review note.");
  return {
    schema_version: 1,
    run_id: audit.run_id,
    raw_result_sha256: audit.raw_result_sha256,
    auditor: audit.auditor,
    audited_at: audit.audited_at,
    metrics: {
      hallucinated_api_calls: hallucinatedApiCalls,
      invalid_api_values: invalidApiValues,
      repair_iterations: repairIterations,
      check_driven_repair_success: metrics.check_driven_repair_success,
    },
    evidence_notes: audit.evidence_notes,
  };
}

export function applyHumanAudit(
  rawResult: BenchmarkResult,
  rawResultSha256: string,
  value: unknown,
): BenchmarkResult {
  validateResult(rawResult);
  const audit = validatedAudit(value);
  if (audit.run_id !== rawResult.run_id) throw new Error("Audit run_id does not match raw result.");
  if (audit.raw_result_sha256 !== rawResultSha256)
    throw new Error("Audit raw result hash does not match the immutable raw result bytes.");
  const audited: BenchmarkResult = {
    ...rawResult,
    ...audit.metrics,
    notes: [
      ...rawResult.notes,
      `Human audit by ${audit.auditor} at ${audit.audited_at}: ${audit.evidence_notes.join(" | ")}`,
    ],
  };
  validateResult(audited);
  return audited;
}

async function rawRun(runId: string): Promise<{
  result: BenchmarkResult;
  hash: string;
}> {
  const content = await readFile(resolve(resultsRoot, `${runId}.json`), "utf8");
  const result: unknown = JSON.parse(content);
  validateResult(result);
  return { result, hash: sha256(content) };
}

export async function auditRun(
  runId: string,
  apply: boolean,
): Promise<Readonly<Record<string, unknown>>> {
  if (!/^[a-z0-9][a-z0-9_.-]*$/i.test(runId)) throw new Error("run-id contains unsafe characters.");
  const raw = await rawRun(runId);
  const auditPath = resolve(auditsRoot, `${runId}.json`);
  const evidence = {
    transcript: resolve(artifactsRoot, runId, "agent.jsonl"),
    cliEvents: resolve(artifactsRoot, runId, "cli-events.json"),
    undefinedApiCandidates: resolve(artifactsRoot, runId, "undefined-api-candidates.json"),
    finalSource: resolve(artifactsRoot, runId, "eac.config.mjs"),
    evaluation: resolve(artifactsRoot, runId, "evaluation.json"),
  };
  if (!apply) {
    await mkdir(auditsRoot, { recursive: true });
    try {
      const handle = await open(auditPath, "wx");
      try {
        await handle.writeFile(
          `${JSON.stringify(createAuditTemplate(raw.result, raw.hash), null, 2)}\n`,
        );
      } finally {
        await handle.close();
      }
      return { mode: "template-created", auditPath, evidence };
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code !== "EEXIST") throw cause;
      return { mode: "template-preserved", auditPath, evidence };
    }
  }
  const audited = applyHumanAudit(raw.result, raw.hash, await readJson(auditPath));
  const auditedResultPath = resolve(auditedResultsRoot, `${runId}.json`);
  await writeJson(auditedResultPath, audited);
  return { mode: "applied", auditPath, auditedResultPath, evidence };
}
