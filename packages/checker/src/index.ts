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

const preventsHarness = (diagnostic: Diagnostic): boolean =>
  diagnostic.severity === "error" &&
  [
    "eac::timeline::invalid-fps",
    "eac::unit::invalid",
    "eac::numeric::invalid",
    "eac::numeric::invalid-opacity",
    "eac::geometry::invalid",
  ].includes(diagnostic.id);

export function checkExperience(experience: ExperienceIR): CheckResult {
  const staticDiagnostics = runStaticRules(experience);
  const hasUnsafeStaticErrors = staticDiagnostics.some(preventsHarness);
  const harness = hasUnsafeStaticErrors
    ? {
        diagnostics: [],
        stats: {
          frames: 0,
          objects: experience.scenes.reduce((total, scene) => total + scene.objects.length, 0),
          timedProperties: experience.scenes.reduce(
            (total, scene) => total + scene.objects.length * 4,
            0,
          ),
          invalidTransforms: 0,
        },
      }
    : runHarness(experience);
  const diagnostics = [...staticDiagnostics, ...harness.diagnostics];
  return {
    diagnostics,
    stats: harness.stats,
    errors: diagnostics.filter((item) => item.severity === "error").length,
    warnings: diagnostics.filter((item) => item.severity === "warning").length,
  };
}

export function formatCheckResult(result: CheckResult): string {
  const harness =
    result.stats.frames === 0 && result.errors > 0
      ? "Harness\n\n- skipped because static validation found unsafe runtime input"
      : `Harness\n\n✓ ${result.stats.frames} frames evaluated\n✓ ${result.stats.objects} objects\n✓ ${result.stats.timedProperties} timed properties\n${result.stats.invalidTransforms === 0 ? "✓ no invalid transforms" : `✗ ${result.stats.invalidTransforms} invalid transforms`}`;
  const diagnostics = result.diagnostics.map(formatDiagnostic).join("\n\n");
  return `${diagnostics ? `${diagnostics}\n\n` : ""}${harness}\n\n${result.errors} errors, ${result.warnings} warnings`;
}
