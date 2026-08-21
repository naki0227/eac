import { walkNodes, type ExperienceIR, type ScenarioIR } from "@eac/ir";
import { error, type Diagnostic } from "./diagnostic.js";

const finite = (value: number): boolean => Number.isFinite(value);

export function runScenarioRules(experience: ExperienceIR, scenario: ScenarioIR): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const where = `scenario ${scenario.name}`;
  const nodes = new Set(
    experience.scenes.flatMap((scene) => walkNodes(scene.nodes).map(({ node }) => node.id)),
  );
  const states = new Set(
    experience.scenes.flatMap((scene) => scene.reactive.states.map((state) => state.name)),
  );

  if (!finite(scenario.duration.value) || scenario.duration.value <= 0)
    diagnostics.push(
      error(
        "eac::scenario::invalid-time",
        `Scenario \`${scenario.name}\` has a non-positive duration.`,
        where,
        "A scenario covers a finite span of the experience timeline.",
        ["set a positive duration"],
      ),
    );
  if (scenario.duration.value > experience.duration.value)
    diagnostics.push(
      error(
        "eac::scenario::out-of-range",
        `Scenario \`${scenario.name}\` is longer than the experience.`,
        where,
        "Replay cannot advance past the end of the experience it drives.",
        ["shorten the scenario", "lengthen the experience duration"],
      ),
    );

  let previousOrder = -1;
  let previousTime = Number.NEGATIVE_INFINITY;
  for (const event of scenario.events) {
    const at = `${where} event ${String(event.order)} (${event.kind})`;
    if (!finite(event.at.value) || event.at.value < 0)
      diagnostics.push(
        error(
          "eac::scenario::invalid-time",
          `Event ${String(event.order)} has a time of \`${String(event.at.value)}\`.`,
          at,
          "Every input event happens at a finite, non-negative time.",
          ["use sec(value) with a value at or after 0"],
        ),
      );
    else if (event.at.value > scenario.duration.value)
      diagnostics.push(
        error(
          "eac::scenario::out-of-range",
          `Event ${String(event.order)} happens after the scenario ends.`,
          at,
          "An event past the scenario duration would never replay.",
          ["move the event earlier", "extend the scenario duration"],
        ),
      );
    if (event.order <= previousOrder || event.at.value < previousTime)
      diagnostics.push(
        error(
          "eac::scenario::unsorted-events",
          `Event ${String(event.order)} breaks the scenario ordering.`,
          at,
          "Events replay in (time, order) sequence; order must strictly increase with non-decreasing time.",
          [
            "rebuild the scenario with the ScenarioBuilder",
            "sort events by time before assigning order",
          ],
        ),
      );
    previousOrder = Math.max(previousOrder, event.order);
    previousTime = Math.max(previousTime, event.at.value);
    if ("x" in event && (!finite(event.x.value) || !finite(event.y.value)))
      diagnostics.push(
        error(
          "eac::scenario::invalid-payload",
          `Event ${String(event.order)} has a non-finite position.`,
          at,
          "Pointer and scroll positions must be finite so hit-testing is defined.",
          ["use px(value) with a finite value"],
        ),
      );
    if ("code" in event && event.code.length === 0)
      diagnostics.push(
        error(
          "eac::scenario::invalid-payload",
          `Event ${String(event.order)} has an empty key code.`,
          at,
          "A keyboard event names one normalized key code.",
          ['use a code such as "Escape" or "ArrowLeft"'],
        ),
      );
  }

  for (const assertion of scenario.assertions) {
    const at = `${where} ${assertion.id}`;
    if (
      !finite(assertion.at.value) ||
      assertion.at.value < 0 ||
      assertion.at.value > scenario.duration.value
    )
      diagnostics.push(
        error(
          "eac::scenario::invalid-time",
          `Assertion \`${assertion.id}\` is outside the scenario timeline.`,
          at,
          "An assertion is checked at one time inside the scenario.",
          ["move the assertion inside 0..duration"],
        ),
      );
    if (assertion.kind === "state" && !states.has(assertion.name))
      diagnostics.push(
        error(
          "eac::scenario::unknown-target",
          `Assertion \`${assertion.id}\` names unknown state \`${assertion.name}\`.`,
          at,
          "Assertions read declared state by name.",
          ["declare it with scene.state(name, initial)", "run eac inspect to list state names"],
        ),
      );
    if (assertion.kind !== "state" && !nodes.has(assertion.node))
      diagnostics.push(
        error(
          "eac::scenario::unknown-target",
          `Assertion \`${assertion.id}\` names unknown node \`${assertion.node}\`.`,
          at,
          "Assertions read a node that must exist in the experience.",
          ["check the node id", "run eac inspect to list node ids"],
        ),
      );
    if (
      assertion.kind === "property" &&
      (!finite(assertion.equals) || !finite(assertion.tolerance) || assertion.tolerance < 0)
    )
      diagnostics.push(
        error(
          "eac::scenario::invalid-payload",
          `Assertion \`${assertion.id}\` has an invalid expected value or tolerance.`,
          at,
          "A property assertion compares finite numbers within a non-negative tolerance.",
          ["use finite numbers", "use a tolerance of 0 or more"],
        ),
      );
  }
  return diagnostics;
}
