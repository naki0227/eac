import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { stdout } from "node:process";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = resolve(repositoryRoot, "bench/results/r3");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function json(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function sha256(path) {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}

async function filesBelow(path) {
  const entries = await readdir(path, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => resolve(entry.parentPath, entry.name));
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

const manifest = await json(resolve(publicRoot, "manifest.json"));
const summary = await json(resolve(publicRoot, "summary.json"));

assert(manifest.schema_version === 1, "manifest schema_version must be 1");
assert(manifest.freeze_sha === summary.freeze_sha, "summary freeze SHA differs from manifest");
assert(manifest.model === summary.model, "summary model differs from manifest");
assert(manifest.reasoning_config === summary.reasoning_config, "reasoning config differs");
assert(
  Array.isArray(manifest.runs) && manifest.runs.length === 15,
  "manifest must contain 15 runs",
);
assert(summary.runs === 15, "summary must aggregate 15 runs");

const ids = manifest.runs.map(({ id }) => id);
assert(new Set(ids).size === 15, "manifest run IDs must be unique");

const metricNames = [
  "hallucinated_api_calls",
  "invalid_api_values",
  "repair_iterations",
  "check_driven_repair_success",
];
const auditedResults = [];

for (const entry of manifest.runs) {
  assert(/^[abc]-[a-z0-9-]+$/.test(entry.id), `unsafe public run ID: ${entry.id}`);
  const resultPath = resolve(publicRoot, "audited-results", `${entry.id}.json`);
  const auditPath = resolve(publicRoot, "audits", `${entry.id}.json`);
  const sourcePath = resolve(publicRoot, "artifacts", entry.id, "eac.config.mjs");
  const result = await json(resultPath);
  const audit = await json(auditPath);
  auditedResults.push(result);

  assert(result.run_id === entry.run_id, `${entry.id}: audited result run ID differs`);
  assert(audit.run_id === entry.run_id, `${entry.id}: audit run ID differs`);
  assert(audit.raw_result_sha256 === entry.raw_result_sha256, `${entry.id}: raw hash differs`);
  assert(result.implementation_commit === manifest.freeze_sha, `${entry.id}: freeze SHA differs`);
  assert(result.model === manifest.model, `${entry.id}: model differs`);
  assert(result.reasoning_config === manifest.reasoning_config, `${entry.id}: reasoning differs`);
  assert(
    result.final_source_sha256 === entry.final_source_sha256,
    `${entry.id}: result source hash differs`,
  );
  assert(
    (await sha256(sourcePath)) === entry.final_source_sha256,
    `${entry.id}: public source bytes differ`,
  );
  assert(
    typeof audit.auditor === "string" && audit.auditor.length > 0,
    `${entry.id}: auditor missing`,
  );
  assert(Number.isFinite(Date.parse(audit.audited_at)), `${entry.id}: audit time invalid`);

  for (const metric of metricNames)
    assert(
      sameJson(result[metric], audit.metrics[metric]),
      `${entry.id}: ${metric} differs from audit`,
    );
}

for (const condition of ["A", "B", "C"]) {
  const runCount = manifest.runs.filter(({ id }) =>
    id.startsWith(`${condition.toLowerCase()}-`),
  ).length;
  assert(runCount === 5, `condition ${condition} must contain five runs`);
  const aggregate = summary.by_condition.find((value) => value.condition === condition);
  const runs = auditedResults.filter((result) => result.condition === condition);
  const total = (field) => runs.reduce((sum, result) => sum + result[field], 0);
  const expected = {
    condition,
    task_completion: runs.filter((result) => result.task_completion).length,
    completed_runs: runs.filter((result) => result.status === "completed").length,
    hallucinated_api_calls: total("hallucinated_api_calls"),
    invalid_api_values: total("invalid_api_values"),
    repair_iterations: total("repair_iterations"),
    check_driven_repair_successes: runs.filter((result) => result.check_driven_repair_success)
      .length,
    docs_searches: total("docs_search_count"),
    direct_docs_calls: total("direct_docs_calls"),
    check_calls: total("check_calls"),
    final_errors: total("final_errors"),
    final_warnings: total("final_warnings"),
  };
  assert(
    sameJson(aggregate, expected),
    `condition ${condition} summary differs from audited results`,
  );
}

const publishedFiles = await filesBelow(publicRoot);
const forbiddenNames = /(?:agent\.jsonl|stderr|stdout|proxy|transcript|auth\.json)/i;
assert(
  publishedFiles.every((path) => !forbiddenNames.test(path)),
  "raw transcript, log, proxy, or auth artifact is present in the public result tree",
);

const sensitiveContent =
  /(?:Authorization:\s*Bearer|OPENAI_API_KEY|sk-[A-Za-z0-9_-]{12,}|\/Users\/[^/]+\/\.codex)/;
for (const path of publishedFiles) {
  const content = await readFile(path, "utf8");
  assert(!sensitiveContent.test(content), `sensitive content pattern found in ${path}`);
}

stdout.write(
  "Verified 15 public audited runs, audit bindings, source hashes, and disclosure boundaries.\n",
);
