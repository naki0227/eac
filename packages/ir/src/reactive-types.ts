import type { ColorIR, PropertyName, StylePropertyName } from "./types.js";
import type { Length, Time } from "@eac/units";

export type SignalValue = number | boolean;
export type SignalValueKind = "number" | "boolean";

export type PointerChannel = "x" | "y" | "down" | "present";
export type ScrollChannel = "x" | "y";
export type ViewportChannel = "width" | "height";

export type SignalRef =
  | Readonly<{ kind: "pointer"; channel: PointerChannel }>
  | Readonly<{ kind: "scroll"; channel: ScrollChannel }>
  | Readonly<{ kind: "viewport"; channel: ViewportChannel }>
  | Readonly<{ kind: "key"; code: string }>
  | Readonly<{ kind: "hover"; node: string }>
  | Readonly<{ kind: "pressed"; node: string }>
  | Readonly<{ kind: "state"; name: string }>;

export type BinaryNumberOperator = "add" | "sub" | "mul" | "div" | "min" | "max";
export type ComparisonOperator = "eq" | "neq" | "lt" | "lte" | "gt" | "gte";
export type BooleanOperator = "and" | "or";

export type ReactiveExpr =
  | Readonly<{ kind: "const"; value: SignalValue }>
  | Readonly<{ kind: "signal"; ref: SignalRef }>
  | Readonly<{ kind: BinaryNumberOperator; left: ReactiveExpr; right: ReactiveExpr }>
  | Readonly<{ kind: "neg"; value: ReactiveExpr }>
  | Readonly<{ kind: ComparisonOperator; left: ReactiveExpr; right: ReactiveExpr }>
  | Readonly<{ kind: BooleanOperator; left: ReactiveExpr; right: ReactiveExpr }>
  | Readonly<{ kind: "not"; value: ReactiveExpr }>
  | Readonly<{
      kind: "conditional";
      condition: ReactiveExpr;
      whenTrue: ReactiveExpr;
      whenFalse: ReactiveExpr;
    }>
  | Readonly<{ kind: "clamp"; value: ReactiveExpr; min: ReactiveExpr; max: ReactiveExpr }>
  | Readonly<{ kind: "lerp"; from: ReactiveExpr; to: ReactiveExpr; progress: ReactiveExpr }>;

export type StateDeclIR = Readonly<{
  name: string;
  valueKind: SignalValueKind;
  initial: SignalValue;
}>;

/**
 * A binding owns one whole property, so it competes with timed writers at exactly the same
 * granularity that the v0.2 single-writer rule already uses.
 */
export type ReactiveBindingIR =
  | Readonly<{ id: string; node: string; property: "position"; x: ReactiveExpr; y: ReactiveExpr }>
  | Readonly<{ id: string; node: string; property: "scale"; x: ReactiveExpr; y: ReactiveExpr }>
  | Readonly<{
      id: string;
      node: string;
      property: "rotation" | "opacity" | "depth" | "blur";
      value: ReactiveExpr;
    }>
  | Readonly<{
      id: string;
      node: string;
      property: "fill" | "stroke";
      from: ColorIR;
      to: ColorIR;
      progress: ReactiveExpr;
    }>;

export type ReactivePropertyName = PropertyName | StylePropertyName;

export type PointerEventName = "pointerEnter" | "pointerLeave" | "pointerDown" | "pointerUp";
export type SemanticEventName = PointerEventName | "click" | "keyDown" | "keyUp" | "scroll";

export type EventTriggerIR =
  | Readonly<{ kind: PointerEventName | "click"; node: string }>
  | Readonly<{ kind: "keyDown" | "keyUp"; code: string }>
  | Readonly<{ kind: "scroll" }>;

export type EventActionIR =
  | Readonly<{ kind: "setState"; state: string; value: ReactiveExpr }>
  | Readonly<{ kind: "toggleState"; state: string }>
  | Readonly<{ kind: "playSound"; sound: string }>;

export type EventRuleIR = Readonly<{
  id: string;
  trigger: EventTriggerIR;
  guard?: ReactiveExpr;
  actions: readonly EventActionIR[];
}>;

/** An audio clip with no start time; it only sounds when a `playSound` action fires. */
export type SoundIR = Readonly<{
  id: string;
  asset: import("./types.js").AudioAssetIR;
  duration?: Time;
  trimStart: Time;
  trimEnd?: Time;
  volume: number;
  fadeIn: Time;
  fadeOut: Time;
}>;

export type ReactiveSceneIR = Readonly<{
  states: readonly StateDeclIR[];
  bindings: readonly ReactiveBindingIR[];
  rules: readonly EventRuleIR[];
  sounds: readonly SoundIR[];
}>;

export const emptyReactiveScene = (): ReactiveSceneIR => ({
  states: [],
  bindings: [],
  rules: [],
  sounds: [],
});

export type ScenarioEventPayload =
  | Readonly<{ kind: "pointerMove"; x: Length; y: Length }>
  | Readonly<{ kind: "pointerDown" }>
  | Readonly<{ kind: "pointerUp" }>
  | Readonly<{ kind: "pointerLeave" }>
  | Readonly<{ kind: "keyDown" | "keyUp"; code: string }>
  | Readonly<{ kind: "scroll"; x: Length; y: Length }>;

export type ScenarioEventIR = Readonly<{ at: Time; order: number }> & ScenarioEventPayload;

export type AssertedProperty = "opacity" | "rotation" | "depth" | "scaleX" | "scaleY" | "x" | "y";

export type ScenarioAssertionPayload =
  | Readonly<{ kind: "state"; name: string; equals: SignalValue }>
  | Readonly<{ kind: "hover"; node: string; equals: boolean }>
  | Readonly<{
      kind: "property";
      node: string;
      property: AssertedProperty;
      equals: number;
      tolerance: number;
    }>;

export type ScenarioAssertionIR = Readonly<{ at: Time; id: string }> & ScenarioAssertionPayload;

export type ScenarioIR = Readonly<{
  version: "0.3";
  scenarioVersion: 1;
  name: string;
  duration: Time;
  initialPointer?: Readonly<{ x: Length; y: Length }>;
  initialScroll?: Readonly<{ x: Length; y: Length }>;
  events: readonly ScenarioEventIR[];
  assertions: readonly ScenarioAssertionIR[];
}>;
