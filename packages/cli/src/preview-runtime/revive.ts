import type { ExperienceIR, ScenarioIR } from "@eac/ir";

/**
 * The preview embeds IR as JSON data, never as executable source. Branded unit values survive
 * `JSON.stringify` as `{ kind, value }` objects, so reviving is structural and needs no `eval`,
 * no `new Function`, and no dynamic import.
 */
const isUnit = (value: unknown): value is Readonly<{ kind: string; value: number }> =>
  typeof value === "object" &&
  value !== null &&
  "kind" in value &&
  "value" in value &&
  typeof (value as { value: unknown }).value === "number";

export function reviveExperience(value: unknown): ExperienceIR {
  const raw = value as Record<string, unknown>;
  if (raw.version !== "0.3" || raw.irVersion !== 3)
    throw new TypeError(
      `Expected EaC v0.3 IR, found version ${String(raw.version)} irVersion ${String(raw.irVersion)}.`,
    );
  return value as ExperienceIR;
}

export function reviveScenario(value: unknown): ScenarioIR | undefined {
  if (value === null || value === undefined) return undefined;
  const raw = value as Record<string, unknown>;
  if (raw.version !== "0.3" || raw.scenarioVersion !== 1)
    throw new TypeError(
      `Expected an EaC v0.3 scenario, found version ${String(raw.version)} scenarioVersion ${String(raw.scenarioVersion)}.`,
    );
  if (!isUnit(raw.duration)) throw new TypeError("Scenario duration must be a Time value.");
  return value as ScenarioIR;
}

/** Serializes ScenarioIR for download, matching the canonical on-disk shape the CLI reads. */
export function scenarioToJson(scenario: ScenarioIR): string {
  const scalar = (unit: Readonly<{ value: number }>): number => unit.value;
  return `${JSON.stringify(
    {
      version: scenario.version,
      scenarioVersion: scenario.scenarioVersion,
      name: scenario.name,
      duration: scalar(scenario.duration),
      events: scenario.events.map((event) => ({
        at: scalar(event.at),
        order: event.order,
        kind: event.kind,
        ...("x" in event ? { x: scalar(event.x), y: scalar(event.y) } : {}),
        ...("code" in event ? { code: event.code } : {}),
      })),
      assertions: scenario.assertions.map((assertion) => ({
        ...assertion,
        at: scalar(assertion.at),
      })),
    },
    null,
    2,
  )}\n`;
}
