import {
  evaluateScene,
  type EvaluatedObject,
  type ExperienceIR,
  type ScenarioEventIR,
  type ScenarioIR,
  type SceneIR,
} from "@eac/ir";
import { computeOverrides } from "./reactive-graph.js";
import { runStep, type SemanticEvent, type StepResult } from "./step-runner.js";
import { initialReplayState, type ReplayState, type StateTransition } from "./state.js";
import { buildSteps, lastStepIndexAt, type ReplayStep } from "./steps.js";

export type StateWriteConflict = Readonly<{
  scene: string;
  state: string;
  rules: readonly string[];
  at: number;
}>;

export type ReplayResult = Readonly<{
  state: ReplayState;
  transitions: readonly StateTransition[];
  events: readonly Readonly<{ at: number; scene: string; event: SemanticEvent }>[];
  conflicts: readonly StateWriteConflict[];
}>;

const CHECKPOINT_INTERVAL = 64;

const primaryScene = (experience: ExperienceIR): SceneIR | undefined => experience.scenes[0];

/**
 * A replay session. Mutable only as an execution optimization: `evaluateAt` must return the same
 * result whether or not a checkpoint happens to be warm, and `replayFresh` exists so tests can
 * assert exactly that.
 */
export class ExperienceSession {
  readonly #experience: ExperienceIR;
  #scenario: ScenarioIR | undefined;
  #steps: readonly ReplayStep[];
  readonly #scene: SceneIR | undefined;
  readonly #checkpoints = new Map<number, ReplayResult>();

  constructor(experience: ExperienceIR, scenario?: ScenarioIR) {
    this.#experience = experience;
    this.#scenario = scenario;
    this.#scene = primaryScene(experience);
    this.#steps = buildSteps(experience, scenario);
  }

  get steps(): readonly ReplayStep[] {
    return this.#steps;
  }

  get scenario(): ScenarioIR | undefined {
    return this.#scenario;
  }

  /**
   * Appends input events to the scenario this session replays. Live preview uses this to grow one
   * scenario as the user interacts, so the same replay machinery serves live and offline evaluation.
   * Checkpoints at or after the first inserted step are dropped; earlier ones stay valid because the
   * steps below the insertion point are unchanged.
   */
  appendEvents(events: readonly ScenarioEventIR[]): void {
    if (events.length === 0) return;
    const base =
      this.#scenario ??
      ({
        version: "0.3",
        scenarioVersion: 1,
        name: "live",
        duration: this.#experience.duration,
        events: [],
        assertions: [],
      } satisfies ScenarioIR);
    this.#scenario = { ...base, events: [...base.events, ...events] };
    const earliest = Math.min(...events.map((event) => event.at.value));
    this.#steps = buildSteps(this.#experience, this.#scenario);
    const firstAffected = this.#steps.findIndex((step) => step.time >= earliest);
    for (const index of [...this.#checkpoints.keys()])
      if (firstAffected >= 0 && index >= firstAffected) this.#checkpoints.delete(index);
  }

  /** Drops every cached checkpoint. Used by reset, and by tests proving the cache is optional. */
  clearCache(): void {
    this.#checkpoints.clear();
  }

  #initial(): ReplayResult {
    return {
      state: initialReplayState(this.#scene?.reactive.states ?? [], this.#scenario),
      transitions: [],
      events: [],
      conflicts: [],
    };
  }

  #advance(from: ReplayResult, fromIndex: number, toIndex: number): ReplayResult {
    const scene = this.#scene;
    if (scene === undefined) return from;
    let state = from.state;
    const transitions = [...from.transitions];
    const events = [...from.events];
    const conflicts = [...from.conflicts];
    for (let index = fromIndex + 1; index <= toIndex; index += 1) {
      const step = this.#steps[index];
      if (step === undefined) continue;
      const result: StepResult = runStep(this.#experience, scene, state, step);
      state = result.state;
      transitions.push(...result.transitions);
      for (const event of result.events) events.push({ at: step.time, scene: scene.id, event });
      for (const conflict of result.conflicts) conflicts.push({ scene: scene.id, ...conflict });
    }
    return { state, transitions, events, conflicts };
  }

  /** Replays from the initial state with no cache. Used to prove caching changes nothing. */
  replayFresh(time: number): ReplayResult {
    return this.#advance(this.#initial(), -1, lastStepIndexAt(this.#steps, time));
  }

  replayTo(time: number): ReplayResult {
    const target = lastStepIndexAt(this.#steps, time);
    if (target < 0) return this.#initial();
    let baseIndex = -1;
    let base = this.#initial();
    for (const [index, checkpoint] of this.#checkpoints)
      if (index <= target && index > baseIndex) {
        baseIndex = index;
        base = checkpoint;
      }
    const result = this.#advance(base, baseIndex, target);
    const checkpointIndex = target - (target % CHECKPOINT_INTERVAL);
    if (
      checkpointIndex > baseIndex &&
      checkpointIndex >= 0 &&
      !this.#checkpoints.has(checkpointIndex)
    )
      this.#checkpoints.set(
        checkpointIndex,
        checkpointIndex === target ? result : this.#advance(base, baseIndex, checkpointIndex),
      );
    return result;
  }

  evaluateAt(time: number): readonly EvaluatedObject[] {
    const scene = this.#scene;
    if (scene === undefined) return [];
    const sceneTime = time - scene.start.value;
    if (sceneTime < 0 || sceneTime > scene.duration.value) return [];
    const replay = this.replayTo(time);
    return evaluateScene(scene, sceneTime, computeOverrides(scene.reactive, replay.state));
  }

  overridesAt(time: number): ReturnType<typeof computeOverrides> {
    const scene = this.#scene;
    if (scene === undefined) return new Map();
    return computeOverrides(scene.reactive, this.replayTo(time).state);
  }
}

export const hasReactiveContent = (experience: ExperienceIR): boolean =>
  experience.scenes.some(
    (scene) =>
      scene.reactive.bindings.length > 0 ||
      scene.reactive.rules.length > 0 ||
      scene.reactive.states.length > 0,
  );
