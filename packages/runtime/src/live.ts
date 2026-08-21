import type {
  EvaluatedObject,
  ExperienceIR,
  ReactiveOverrides,
  ScenarioEventIR,
  ScenarioEventPayload,
  ScenarioIR,
} from "@eac/ir";
import { sec } from "@eac/units";
import { ExperienceSession, type ReplayResult } from "./session.js";
import type { ReplayState } from "./state.js";

export type LiveOptions = Readonly<{ name?: string }>;

/**
 * Drives one `ExperienceSession` from live input without adding any evaluation of its own.
 *
 * Input is buffered and stamped at the frame it is committed to, so live interaction is quantized
 * exactly like scenario replay (ADR 0009). The accumulated events *are* a scenario: exporting and
 * replaying it in a fresh session reproduces what the user just saw, which is the property the
 * record-then-replay workflow depends on.
 */
export class LiveSession {
  readonly #experience: ExperienceIR;
  readonly #name: string;
  readonly #fps: number;
  readonly #lastFrame: number;
  #session: ExperienceSession;
  #buffered: ScenarioEventPayload[] = [];
  #events: ScenarioEventIR[] = [];
  #frame = 0;
  #result: ReplayResult;

  constructor(experience: ExperienceIR, options: LiveOptions = {}) {
    this.#experience = experience;
    this.#name = options.name ?? "recorded";
    this.#fps = Number.isFinite(experience.fps) && experience.fps > 0 ? experience.fps : 1;
    this.#lastFrame = Math.max(0, Math.floor(experience.duration.value * this.#fps + 1e-9));
    this.#session = new ExperienceSession(experience);
    this.#result = this.#session.replayTo(0);
  }

  get fps(): number {
    return this.#fps;
  }

  get lastFrame(): number {
    return this.#lastFrame;
  }

  get frame(): number {
    return this.#frame;
  }

  get time(): number {
    return this.#frame / this.#fps;
  }

  get state(): ReplayState {
    return this.#result.state;
  }

  get result(): ReplayResult {
    return this.#result;
  }

  get pendingInputCount(): number {
    return this.#buffered.length;
  }

  /** Buffers a normalized input. It takes effect at the next committed frame, never mid-frame. */
  queue(payload: ScenarioEventPayload): void {
    this.#buffered.push(payload);
  }

  /**
   * Commits buffered input at `frame` and replays up to it. Moving to an earlier frame is a pure
   * re-read of the same scenario, so scrubbing backwards never mutates history.
   */
  advanceTo(frame: number): void {
    const target = Math.max(0, Math.min(this.#lastFrame, Math.trunc(frame)));
    if (this.#buffered.length > 0) {
      const at = sec(target / this.#fps);
      const appended = this.#buffered.map((payload, index) => ({
        ...payload,
        at,
        order: this.#events.length + index,
      })) as ScenarioEventIR[];
      this.#events = [...this.#events, ...appended];
      this.#buffered = [];
      this.#session.appendEvents(appended);
    }
    this.#frame = target;
    this.#result = this.#session.replayTo(this.time);
  }

  step(delta: number): void {
    this.advanceTo(this.#frame + delta);
  }

  overrides(): ReactiveOverrides {
    return this.#session.overridesAt(this.time);
  }

  evaluate(): readonly EvaluatedObject[] {
    return this.#session.evaluateAt(this.time);
  }

  /** The interaction so far, as an ordinary scenario. */
  scenario(): ScenarioIR {
    return {
      version: "0.3",
      scenarioVersion: 1,
      name: this.#name,
      duration: this.#experience.duration,
      events: [...this.#events],
      assertions: [],
    };
  }

  /** Restores the initial state completely: time, signals, app state, history, and caches. */
  reset(): void {
    this.#buffered = [];
    this.#events = [];
    this.#frame = 0;
    this.#session = new ExperienceSession(this.#experience);
    this.#result = this.#session.replayTo(0);
  }
}
