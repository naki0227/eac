import { visualObjects, walkNodes, type ExperienceIR, type ScenarioIR } from "@eac/ir";
import { type Diagnostic, formatDiagnostic } from "./diagnostic.js";
import { runHarness, type HarnessStats } from "./harness.js";
import { runStaticRules } from "./static-rules.js";
import { runScenarioRules } from "./scenario-rules.js";
import { runScenarioHarness, type ScenarioStats } from "./scenario-harness.js";

export * from "./diagnostic.js";
export * from "./harness.js";
export { runScenarioRules } from "./scenario-rules.js";
export { runScenarioHarness } from "./scenario-harness.js";
export type { ScenarioStats } from "./scenario-harness.js";

export type CheckResult = Readonly<{
  diagnostics: readonly Diagnostic[];
  stats: HarnessStats;
  scenario?: ScenarioStats;
  errors: number;
  warnings: number;
}>;

const preventsHarness = (diagnostic: Diagnostic): boolean =>
  diagnostic.severity === "error" &&
  (diagnostic.id.startsWith("eac::asset::") ||
    [
      "eac::timeline::invalid-fps",
      "eac::unit::invalid",
      "eac::numeric::invalid",
      "eac::numeric::invalid-opacity",
      "eac::transform::invalid-scale",
      "eac::motion::invalid-easing",
      "eac::geometry::invalid",
      "eac::color::invalid",
      "eac::style::invalid",
      "eac::hierarchy::cycle",
      "eac::reactive::cycle",
      "eac::reactive::type-mismatch",
      "eac::reactive::undefined-signal",
    ].includes(diagnostic.id));

export function checkExperience(experience: ExperienceIR, scenario?: ScenarioIR): CheckResult {
  const staticDiagnostics = [
    ...runStaticRules(experience),
    ...(scenario === undefined ? [] : runScenarioRules(experience, scenario)),
  ];
  const hasUnsafeStaticErrors = staticDiagnostics.some(preventsHarness);
  const harness = hasUnsafeStaticErrors
    ? {
        diagnostics: [],
        stats: {
          frames: 0,
          objects: experience.scenes.reduce(
            (total, scene) => total + visualObjects(scene.nodes).length,
            0,
          ),
          timedProperties: experience.scenes.reduce(
            (total, scene) =>
              total + walkNodes(scene.nodes).length * 5 + visualObjects(scene.nodes).length * 3,
            0,
          ),
          invalidTransforms: 0,
        },
      }
    : runHarness(experience);
  const scenarioRun =
    scenario === undefined || hasUnsafeStaticErrors
      ? undefined
      : runScenarioHarness(experience, scenario);
  const diagnostics = [
    ...staticDiagnostics,
    ...harness.diagnostics,
    ...(scenarioRun?.diagnostics ?? []),
  ];
  return {
    diagnostics,
    stats: harness.stats,
    ...(scenarioRun === undefined ? {} : { scenario: scenarioRun.stats }),
    errors: diagnostics.filter((item) => item.severity === "error").length,
    warnings: diagnostics.filter((item) => item.severity === "warning").length,
  };
}

export function formatCheckResult(result: CheckResult): string {
  const harness =
    result.stats.frames === 0 && result.errors > 0
      ? "Harness\n\n- skipped because static validation found unsafe runtime input"
      : `Harness\n\n✓ ${result.stats.frames} frames evaluated\n✓ ${result.stats.objects} objects\n✓ ${result.stats.timedProperties} timed properties\n${result.stats.invalidTransforms === 0 ? "✓ no invalid transforms" : `✗ ${result.stats.invalidTransforms} invalid transforms`}`;
  const scenario =
    result.scenario === undefined
      ? ""
      : `\n\nScenario\n\n✓ ${result.scenario.steps} replay steps\n✓ ${result.scenario.events} semantic events\n✓ ${result.scenario.transitions} state transitions\n${result.scenario.failedAssertions === 0 ? `✓ ${result.scenario.assertions} assertions passed` : `✗ ${result.scenario.failedAssertions} of ${result.scenario.assertions} assertions failed`}`;
  const diagnostics = result.diagnostics.map(formatDiagnostic).join("\n\n");
  return `${diagnostics ? `${diagnostics}\n\n` : ""}${harness}${scenario}\n\n${result.errors} errors, ${result.warnings} warnings`;
}
