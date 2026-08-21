import type {
  AssertedProperty,
  ScenarioAssertionIR,
  ScenarioEventIR,
  ScenarioEventPayload,
  ScenarioIR,
  SignalValue,
} from "@eac/ir";
import { px, sec, type Length, type Time } from "@eac/units";

type NodeLike = string | Readonly<{ ir: Readonly<{ id: string }> }>;
const idOf = (node: NodeLike): string => (typeof node === "string" ? node : node.ir.id);

/**
 * Emits ScenarioIR. `order` is a strictly increasing global sequence assigned here, so two events
 * can never tie and replay ordering is fixed by construction rather than by sort stability.
 */
export class ScenarioBuilder {
  readonly #events: ScenarioEventIR[] = [];
  readonly #assertions: ScenarioAssertionIR[] = [];
  #initialPointer: Readonly<{ x: Length; y: Length }> | undefined;
  #initialScroll: Readonly<{ x: Length; y: Length }> | undefined;

  constructor(
    private readonly name: string,
    private readonly duration: Time,
  ) {}

  startPointerAt(x: Length, y: Length): this {
    this.#initialPointer = { x, y };
    return this;
  }

  startScrollAt(x: Length, y: Length): this {
    this.#initialScroll = { x, y };
    return this;
  }

  #push(at: Time, event: ScenarioEventPayload): this {
    this.#events.push({ ...event, at, order: this.#events.length });
    return this;
  }

  pointerMove(at: Time, x: Length, y: Length): this {
    return this.#push(at, { kind: "pointerMove", x, y });
  }

  pointerDown(at: Time): this {
    return this.#push(at, { kind: "pointerDown" });
  }

  pointerUp(at: Time): this {
    return this.#push(at, { kind: "pointerUp" });
  }

  pointerLeave(at: Time): this {
    return this.#push(at, { kind: "pointerLeave" });
  }

  /** Convenience for the common gesture; still lowers to explicit down/up events. */
  click(at: Time, x?: Length, y?: Length): this {
    if (x !== undefined && y !== undefined) this.pointerMove(at, x, y);
    return this.pointerDown(at).pointerUp(sec(at.value + 1e-6));
  }

  keyDown(at: Time, code: string): this {
    return this.#push(at, { kind: "keyDown", code });
  }

  keyUp(at: Time, code: string): this {
    return this.#push(at, { kind: "keyUp", code });
  }

  scrollTo(at: Time, x: Length, y: Length): this {
    return this.#push(at, { kind: "scroll", x, y });
  }

  expectState(at: Time, name: string, equals: SignalValue): this {
    this.#assertions.push({
      at,
      id: `assert-${String(this.#assertions.length + 1)}`,
      kind: "state",
      name,
      equals,
    });
    return this;
  }

  expectHover(at: Time, node: NodeLike, equals: boolean): this {
    this.#assertions.push({
      at,
      id: `assert-${String(this.#assertions.length + 1)}`,
      kind: "hover",
      node: idOf(node),
      equals,
    });
    return this;
  }

  expectProperty(
    at: Time,
    node: NodeLike,
    property: AssertedProperty,
    equals: number,
    tolerance = 1e-6,
  ): this {
    this.#assertions.push({
      at,
      id: `assert-${String(this.#assertions.length + 1)}`,
      kind: "property",
      node: idOf(node),
      property,
      equals,
      tolerance,
    });
    return this;
  }

  build(): ScenarioIR {
    return {
      version: "0.3",
      scenarioVersion: 1,
      name: this.name,
      duration: this.duration,
      ...(this.#initialPointer === undefined ? {} : { initialPointer: this.#initialPointer }),
      ...(this.#initialScroll === undefined ? {} : { initialScroll: this.#initialScroll }),
      events: [...this.#events],
      assertions: [...this.#assertions],
    };
  }
}

export function scenario(
  name: string,
  options: Readonly<{ duration: Time }>,
  define?: (builder: ScenarioBuilder) => void,
): ScenarioBuilder {
  const builder = new ScenarioBuilder(name, options.duration);
  define?.(builder);
  return builder;
}

/** Parses ScenarioIR from JSON, restoring branded units. Data only — never executes the file. */
export function parseScenario(value: unknown): ScenarioIR {
  const raw = value as Record<string, unknown>;
  if (raw.version !== "0.3" || raw.scenarioVersion !== 1)
    throw new TypeError(
      `Expected an EaC v0.3 scenario, found version ${String(raw.version)} scenarioVersion ${String(raw.scenarioVersion)}. Rebuild it with the ScenarioBuilder or re-record it.`,
    );
  const scalar = (input: unknown): number =>
    typeof input === "object" && input !== null && "value" in input
      ? Number(input.value)
      : Number(input);
  const time = (input: unknown): Time => sec(scalar(input));
  const length = (input: unknown): Length => px(scalar(input));
  const text = (input: unknown, fallback: string): string =>
    typeof input === "string" ? input : fallback;
  const events = (raw.events as readonly Record<string, unknown>[] | undefined) ?? [];
  const assertions = (raw.assertions as readonly Record<string, unknown>[] | undefined) ?? [];
  const point = (input: unknown): Readonly<{ x: Length; y: Length }> | undefined => {
    if (typeof input !== "object" || input === null) return undefined;
    const record = input as Record<string, unknown>;
    return { x: length(record.x), y: length(record.y) };
  };
  const initialPointer = point(raw.initialPointer);
  const initialScroll = point(raw.initialScroll);
  return {
    version: "0.3",
    scenarioVersion: 1,
    name: text(raw.name, "scenario"),
    duration: time(raw.duration),
    ...(initialPointer === undefined ? {} : { initialPointer }),
    ...(initialScroll === undefined ? {} : { initialScroll }),
    events: events.map((event, index) => ({
      ...event,
      at: time(event.at),
      order: typeof event.order === "number" ? event.order : index,
      ...(event.x === undefined ? {} : { x: length(event.x) }),
      ...(event.y === undefined ? {} : { y: length(event.y) }),
    })) as unknown as readonly ScenarioEventIR[],
    assertions: assertions.map((assertion, index) => ({
      ...assertion,
      at: time(assertion.at),
      id: text(assertion.id, `assert-${String(index + 1)}`),
    })) as unknown as readonly ScenarioAssertionIR[],
  };
}
