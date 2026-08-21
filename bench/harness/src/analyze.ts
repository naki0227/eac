import { readJson, listJsonFiles } from "./fs.js";
import { resultsRoot } from "./config.js";
import { summarize, validateResult } from "./result.js";
import type { BenchmarkResult } from "./types.js";

export async function analyzeResults(): Promise<string> {
  const results: BenchmarkResult[] = [];
  for (const path of await listJsonFiles(resultsRoot)) {
    const value = await readJson(path);
    validateResult(value);
    results.push(value);
  }
  const summary = summarize(results);
  return `${JSON.stringify(
    {
      runs: results.length,
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
