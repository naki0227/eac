import {
  evaluateExpression,
  evaluateScene,
  hitTest,
  type EventRuleIR,
  type ExperienceIR,
  type SceneIR,
  type SemanticEventName,
  type SignalValue,
} from "@eac/ir";
import { computeOverrides, signalReader } from "./reactive-graph.js";
import { cloneStates, type ReplayState, type StateTransition } from "./state.js";
import type { ReplayStep } from "./steps.js";

export type SemanticEvent = Readonly<{ name: SemanticEventName; target?: string; code?: string }>;

export type StepResult = Readonly<{
  state: ReplayState;
  events: readonly SemanticEvent[];
  transitions: readonly StateTransition[];
  conflicts: readonly Readonly<{ state: string; rules: readonly string[]; at: number }>[];
}>;

const withoutKey = (keys: readonly string[], code: string): readonly string[] =>
  keys.filter((key) => key !== code);

/** Phase 2 of ADR 0009: a scenario event updates raw signals; a tick changes none. */
function applyRawInput(state: ReplayState, step: ReplayStep): ReplayState {
  if (step.kind !== "event") return state;
  const event = step.event;
  switch (event.kind) {
    case "pointerMove":
      return {
        ...state,
        pointer: { ...state.pointer, x: event.x.value, y: event.y.value, present: true },
      };
    case "pointerDown":
      return { ...state, pointer: { ...state.pointer, down: true } };
    case "pointerUp":
      return { ...state, pointer: { ...state.pointer, down: false } };
    case "pointerLeave":
      return {
        ...state,
        pointer: { ...state.pointer, present: false, down: false, x: Number.NaN, y: Number.NaN },
      };
    case "keyDown":
      return state.keys.includes(event.code)
        ? state
        : { ...state, keys: [...state.keys, event.code].sort() };
    case "keyUp":
      return { ...state, keys: withoutKey(state.keys, event.code) };
    default:
      return { ...state, scroll: { x: event.x.value, y: event.y.value } };
  }
}

/** Phase 4 of ADR 0009: derive semantic events in a fixed, documented order. */
function deriveEvents(
  previous: ReplayState,
  next: ReplayState,
  step: ReplayStep,
  hoverTarget: string | undefined,
): readonly SemanticEvent[] {
  const events: SemanticEvent[] = [];
  const wasHover = previous.hoverTarget;
  if (wasHover !== undefined && wasHover !== hoverTarget)
    events.push({ name: "pointerLeave", target: wasHover });
  if (hoverTarget !== undefined && hoverTarget !== wasHover)
    events.push({ name: "pointerEnter", target: hoverTarget });
  if (!previous.pointer.down && next.pointer.down)
    events.push(
      hoverTarget === undefined
        ? { name: "pointerDown" }
        : { name: "pointerDown", target: hoverTarget },
    );
  if (previous.pointer.down && !next.pointer.down) {
    events.push(
      hoverTarget === undefined
        ? { name: "pointerUp" }
        : { name: "pointerUp", target: hoverTarget },
    );
    if (
      previous.pressedTarget !== undefined &&
      hoverTarget !== undefined &&
      previous.pressedTarget === hoverTarget
    )
      events.push({ name: "click", target: hoverTarget });
  }
  if (step.kind === "event") {
    const event = step.event;
    if (event.kind === "keyDown" && !previous.keys.includes(event.code))
      events.push({ name: "keyDown", code: event.code });
    if (event.kind === "keyUp" && previous.keys.includes(event.code))
      events.push({ name: "keyUp", code: event.code });
    if (event.kind === "scroll") events.push({ name: "scroll" });
  }
  return events;
}

const ruleMatches = (rule: EventRuleIR, event: SemanticEvent): boolean => {
  const trigger = rule.trigger;
  if (trigger.kind === "scroll") return event.name === "scroll";
  if ("code" in trigger) return event.name === trigger.kind && event.code === trigger.code;
  return event.name === trigger.kind && event.target === trigger.node;
};

const optional = <K extends string, T>(key: K, value: T | undefined): Record<K, T> | object =>
  value === undefined ? {} : { [key]: value };

/**
 * Runs one replay step over one scene. Guards read the state as it stood when the step began, so
 * rules inside a step never observe each other's writes.
 */
export function runStep(
  experience: ExperienceIR,
  scene: SceneIR,
  state: ReplayState,
  step: ReplayStep,
): StepResult {
  const sceneTime = step.time - scene.start.value;
  const interactionScene = evaluateScene(scene, sceneTime, computeOverrides(scene.reactive, state));
  const next = applyRawInput(state, step);
  const sceneActive = sceneTime >= 0 && sceneTime <= scene.duration.value;
  const hoverTarget =
    next.pointer.present && sceneActive
      ? hitTest(interactionScene, next.pointer.x, next.pointer.y)
      : undefined;
  const events = deriveEvents(state, next, step, hoverTarget);

  const before = state.states;
  const values = cloneStates(before);
  const writers = new Map<string, string[]>();
  const transitions: StateTransition[] = [];
  const sounds = [...state.sounds];
  const read = signalReader({ ...next, ...optional("hoverTarget", hoverTarget), states: before });

  for (const event of events)
    for (const rule of scene.reactive.rules) {
      if (!ruleMatches(rule, event)) continue;
      if (rule.guard !== undefined && evaluateExpression(rule.guard, read) !== true) continue;
      for (const action of rule.actions) {
        if (action.kind === "playSound") {
          sounds.push({ sound: action.sound, at: step.time });
          continue;
        }
        const current = before[action.state];
        if (current === undefined) continue;
        const value: SignalValue =
          action.kind === "toggleState" ? current !== true : evaluateExpression(action.value, read);
        writers.set(action.state, [...(writers.get(action.state) ?? []), rule.id]);
        values[action.state] = value;
        transitions.push({
          at: step.time,
          stepIndex: step.order,
          event: event.name,
          ...(event.target === undefined ? {} : { target: event.target }),
          state: action.state,
          from: current,
          to: value,
        });
      }
    }

  const conflicts = [...writers]
    .filter(([, rules]) => rules.length > 1)
    .map(([name, rules]) => ({ state: name, rules, at: step.time }));

  return {
    state: {
      stepIndex: step.order,
      time: step.time,
      pointer: next.pointer,
      scroll: next.scroll,
      keys: next.keys,
      states: values,
      ...optional("hoverTarget", hoverTarget),
      ...optional("pressedTarget", pressedAfter(state, next, hoverTarget)),
      sounds,
    },
    events,
    transitions,
    conflicts,
  };
}

function pressedAfter(
  previous: ReplayState,
  next: ReplayState,
  hoverTarget: string | undefined,
): string | undefined {
  if (!previous.pointer.down && next.pointer.down) return hoverTarget;
  if (!next.pointer.down) return undefined;
  return previous.pressedTarget;
}
