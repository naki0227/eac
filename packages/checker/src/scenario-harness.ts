import { transformPoint, type ExperienceIR, type ScenarioIR } from "@eac/ir";
import { ExperienceSession } from "@eac/runtime";
import { error, type Diagnostic } from "./diagnostic.js";

export type ScenarioStats = Readonly<{
  steps: number;
  events: number;
  transitions: number;
  assertions: number;
  failedAssertions: number;
}>;

function measure(
  session: ExperienceSession,
  time: number,
  node: string,
  property: string,
): number | undefined {
  const evaluated = session.evaluateAt(time).find((item) => item.object.id === node);
  if (evaluated === undefined) return undefined;
  const [a, b, c, d] = evaluated.matrix;
  const [x, y] = transformPoint(evaluated.matrix, 0, 0);
  switch (property) {
    case "opacity":
      return evaluated.opacity;
    case "depth":
      return evaluated.depth;
    case "x":
      return x;
    case "y":
      return y;
    case "scaleX":
      return Math.hypot(a, b);
    case "scaleY":
      return Math.hypot(c, d);
    default:
      return (Math.atan2(b, a) * 180) / Math.PI;
  }
}

/**
 * Runs the scenario and reports assertion failures plus any state write that collided inside one
 * step. Replay itself is deterministic, so this harness is a pure function of source and scenario.
 */
export function runScenarioHarness(
  experience: ExperienceIR,
  scenario: ScenarioIR,
): Readonly<{ diagnostics: Diagnostic[]; stats: ScenarioStats }> {
  const session = new ExperienceSession(experience, scenario);
  const final = session.replayTo(scenario.duration.value);
  const diagnostics: Diagnostic[] = final.conflicts.map((conflict) =>
    error(
      "eac::reactive::multiple-state-writers",
      `\`${conflict.state}\` was written by ${conflict.rules.length.toString()} rules at ${conflict.at.toFixed(3)}s.`,
      `${conflict.scene}.state.${conflict.state}`,
      "Rules matching one event run in the same step, so two writers have no defined order.",
      ["guard the rules so only one applies", "merge them into a single rule"],
    ),
  );
  let failed = 0;
  for (const assertion of scenario.assertions) {
    const replay = session.replayTo(assertion.at.value);
    const describe = (actual: string, expected: string): void => {
      failed += 1;
      diagnostics.push(
        error(
          "eac::scenario::assertion-failed",
          `Assertion \`${assertion.id}\` expected ${expected} at ${assertion.at.value.toFixed(3)}s but found ${actual}.`,
          `scenario ${scenario.name} ${assertion.id}`,
          "A scenario assertion pins the replayed result so an interaction can regress loudly.",
          ["update the expectation", "check the scenario events leading to this time"],
        ),
      );
    };
    if (assertion.kind === "state") {
      const actual = replay.state.states[assertion.name];
      if (actual !== assertion.equals)
        describe(String(actual), `\`${assertion.name}\` to be ${String(assertion.equals)}`);
      continue;
    }
    if (assertion.kind === "hover") {
      const actual = replay.state.hoverTarget === assertion.node;
      if (actual !== assertion.equals)
        describe(String(actual), `hover(${assertion.node}) to be ${String(assertion.equals)}`);
      continue;
    }
    const actual = measure(session, assertion.at.value, assertion.node, assertion.property);
    if (actual === undefined) describe("no evaluated node", `\`${assertion.node}\` to be visible`);
    else if (Math.abs(actual - assertion.equals) > assertion.tolerance)
      describe(
        actual.toFixed(6),
        `\`${assertion.node}.${assertion.property}\` to be ${assertion.equals.toFixed(6)}`,
      );
  }
  return {
    diagnostics,
    stats: {
      steps: session.steps.length,
      events: final.events.length,
      transitions: final.transitions.length,
      assertions: scenario.assertions.length,
      failedAssertions: failed,
    },
  };
}
