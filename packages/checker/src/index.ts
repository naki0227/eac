import type { ExperienceIR } from "@eac/ir";
import { type Diagnostic, formatDiagnostic } from "./diagnostic.js";
import { runHarness, type HarnessStats } from "./harness.js";
import { runStaticRules } from "./static-rules.js";

export * from "./diagnostic.js";
export * from "./harness.js";

export type CheckResult = Readonly<{
  diagnostics: readonly Diagnostic[];
  stats: HarnessStats;
  errors: number;
  warnings: number;
}>;

export function checkExperience(experience: ExperienceIR): CheckResult {
  const staticDiagnostics = runStaticRules(experience);
  const harness = runHarness(experience);
  const diagnostics = [...staticDiagnostics, ...harness.diagnostics];
  return {
    diagnostics,
    stats: harness.stats,
    errors: diagnostics.filter((item) => item.severity === "error").length,
    warnings: diagnostics.filter((item) => item.severity === "warning").length,
  };
}

export function formatCheckResult(result: CheckResult): string {
  const harness = `Harness\n\n✓ ${result.stats.frames} frames evaluated\n✓ ${result.stats.objects} objects\n✓ ${result.stats.timedProperties} timed properties\n${result.stats.invalidTransforms === 0 ? "✓ no invalid transforms" : `✗ ${result.stats.invalidTransforms} invalid transforms`}`;
  const diagnostics = result.diagnostics.map(formatDiagnostic).join("\n\n");
  return `${diagnostics ? `${diagnostics}\n\n` : ""}${harness}\n\n${result.errors} errors, ${result.warnings} warnings`;
}
