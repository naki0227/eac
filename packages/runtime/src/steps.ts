import type { ExperienceIR, ScenarioEventIR, ScenarioIR } from "@eac/ir";

export type ReplayStep =
  | Readonly<{ kind: "tick"; time: number; rank: 0; order: number }>
  | Readonly<{ kind: "event"; time: number; rank: 1; order: number; event: ScenarioEventIR }>;

/**
 * The replay timeline is the merge of frame ticks and scenario events, sorted by
 * (time, rank, order). A tick shares its timestamp with an event but always runs first: the scene
 * moves, then the input arrives. See ADR 0009.
 */
export function buildSteps(
  experience: ExperienceIR,
  scenario: ScenarioIR | undefined,
): readonly ReplayStep[] {
  const fps = Number.isFinite(experience.fps) && experience.fps > 0 ? experience.fps : 1;
  const duration = Math.max(0, experience.duration.value);
  const frameCount = Math.floor(duration * fps + 1e-9);
  const steps: ReplayStep[] = [];
  for (let frame = 0; frame <= frameCount; frame += 1)
    steps.push({ kind: "tick", time: frame / fps, rank: 0, order: frame });
  for (const event of scenario?.events ?? [])
    steps.push({ kind: "event", time: event.at.value, rank: 1, order: event.order, event });
  return steps.sort(
    (left, right) => left.time - right.time || left.rank - right.rank || left.order - right.order,
  );
}

/** Index of the last step at or before `time`, or -1 when no step has happened yet. */
export function lastStepIndexAt(steps: readonly ReplayStep[], time: number): number {
  let low = 0;
  let high = steps.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const step = steps[middle];
    if (step !== undefined && step.time <= time) {
      found = middle;
      low = middle + 1;
    } else high = middle - 1;
  }
  return found;
}
