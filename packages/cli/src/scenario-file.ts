import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseScenario } from "@eac/core";
import type { ScenarioIR } from "@eac/ir";

const isBuildable = (value: unknown): value is Readonly<{ build: () => ScenarioIR }> =>
  typeof value === "object" &&
  value !== null &&
  "build" in value &&
  typeof (value as { build?: unknown }).build === "function";

/**
 * Loads a scenario from `.json` (pure data) or from a TypeScript/ESM builder module. JSON is never
 * executed; it is parsed and validated into ScenarioIR.
 */
export async function loadScenario(path: string): Promise<ScenarioIR> {
  const target = resolve(path);
  if (target.endsWith(".json")) {
    const parsed: unknown = JSON.parse(await readFile(target, "utf8"));
    return parseScenario(parsed);
  }
  const module: unknown = await import(`${pathToFileURL(target).href}?t=${Date.now()}`);
  const exported =
    typeof module === "object" && module !== null && "default" in module
      ? module.default
      : undefined;
  if (isBuildable(exported)) return exported.build();
  if (typeof exported === "object" && exported !== null) return parseScenario(exported);
  throw new TypeError(
    `${target} must default-export a ScenarioBuilder or an EaC v0.3 scenario object.`,
  );
}

/** Serializes ScenarioIR to the canonical on-disk shape: plain numbers, no branded unit objects. */
export function serializeScenario(scenario: ScenarioIR): string {
  const scalar = (value: Readonly<{ value: number }>): number => value.value;
  const point = (value: Readonly<{ x: { value: number }; y: { value: number } }> | undefined) =>
    value === undefined ? undefined : { x: scalar(value.x), y: scalar(value.y) };
  return `${JSON.stringify(
    {
      version: scenario.version,
      scenarioVersion: scenario.scenarioVersion,
      name: scenario.name,
      duration: scalar(scenario.duration),
      ...(point(scenario.initialPointer) === undefined
        ? {}
        : { initialPointer: point(scenario.initialPointer) }),
      ...(point(scenario.initialScroll) === undefined
        ? {}
        : { initialScroll: point(scenario.initialScroll) }),
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

export const scenarioArgument = (args: readonly string[]): string | undefined => {
  const index = args.indexOf("--scenario");
  return index < 0 ? undefined : args[index + 1];
};

export const scenarioDirectory = (path: string): string => dirname(resolve(path));
