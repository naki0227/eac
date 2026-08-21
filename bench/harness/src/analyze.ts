import { readJson, listJsonFiles } from "./fs.js";
import { auditedResultsRoot, resultsRoot } from "./config.js";
import { summarize, validateResult } from "./result.js";
import type { BenchmarkResult } from "./types.js";
import { basename } from "node:path";

export async function analyzeResults(audited = false): Promise<string> {
  const results: BenchmarkResult[] = [];
  const paths = await listJsonFiles(audited ? auditedResultsRoot : resultsRoot);
  if (audited) {
    const rawNames = (await listJsonFiles(resultsRoot)).map((path) => basename(path));
    const auditedNames = paths.map((path) => basename(path));
    if (JSON.stringify(rawNames) !== JSON.stringify(auditedNames))
      throw new Error("Audited analysis requires one audited result for every raw result.");
  }
  for (const path of paths) {
    const value = await readJson(path);
    validateResult(value);
    results.push(value);
  }
  const summary = summarize(results);
  return `${JSON.stringify(
    {
      runs: results.length,
      authority: audited ? "human-audited" : "raw",
      byCondition: summary,
      comparisons: {
        "A-vs-B": { from: summary[0], to: summary[1] },
        "B-vs-C": { from: summary[1], to: summary[2] },
      },
      caution: "Descriptive aggregation only; raw records are authoritative.",
    },
    null,
    2,
  )}\n`;
}
