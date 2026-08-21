import type {
  EventActionIR,
  EventRuleIR,
  EventTriggerIR,
  ReactiveBindingIR,
  ReactiveExpr,
  SignalValue,
  SoundIR,
  StateDeclIR,
} from "@eac/ir";
import { sec, type Time } from "@eac/units";
import { asset } from "./asset.js";
import { normalizeColor, type ColorInput } from "./color.js";
import { expr, nodeId, type ExprInput } from "./reactive.js";

export type StateHandle<T extends SignalValue> = Readonly<{
  name: string;
  valueKind: T extends boolean ? "boolean" : "number";
  /** The state read back as an expression, so `when(expanded, 1, 0)` reads naturally. */
  value: ReactiveExpr;
}>;

export type SoundHandle = Readonly<{ id: string }>;

export type BindingInput = Readonly<{
  position?: Readonly<{ x: ExprInput; y: ExprInput }>;
  scale?: ExprInput | Readonly<{ x: ExprInput; y: ExprInput }>;
  rotation?: ExprInput;
  opacity?: ExprInput;
  depth?: ExprInput;
  blur?: ExprInput;
  fill?: Readonly<{ from: ColorInput; to: ColorInput; progress: ExprInput }>;
  stroke?: Readonly<{ from: ColorInput; to: ColorInput; progress: ExprInput }>;
}>;

export type SoundOptions = Readonly<{
  duration?: Time;
  trim?: Readonly<{ start?: Time; end?: Time }>;
  volume?: number;
  fadeIn?: Time;
  fadeOut?: Time;
}>;

type NodeLike = string | Readonly<{ ir: Readonly<{ id: string }> }>;

/** Mutable authoring collector; `build()` freezes it into the scene's immutable ReactiveSceneIR. */
export class ReactiveScene {
  readonly states: StateDeclIR[] = [];
  readonly bindings: ReactiveBindingIR[] = [];
  readonly rules: EventRuleIR[] = [];
  readonly sounds: SoundIR[] = [];

  #declareState<T extends SignalValue>(
    name: string,
    valueKind: "boolean" | "number",
    initial: T,
  ): StateHandle<T> {
    this.states.push({ name, valueKind, initial });
    return {
      name,
      valueKind: valueKind as StateHandle<T>["valueKind"],
      value: { kind: "signal", ref: { kind: "state", name } },
    };
  }

  booleanState(name: string, initial: boolean): StateHandle<boolean> {
    return this.#declareState(name, "boolean", initial);
  }

  numberState(name: string, initial: number): StateHandle<number> {
    return this.#declareState(name, "number", initial);
  }

  bind(node: NodeLike, input: BindingInput): void {
    const id = nodeId(node);
    const push = (binding: ReactiveBindingIR): void => {
      this.bindings.push(binding);
    };
    const bindingId = (property: string): string => `${id}.${property}.reactive`;
    if (input.position !== undefined)
      push({
        id: bindingId("position"),
        node: id,
        property: "position",
        x: expr(input.position.x),
        y: expr(input.position.y),
      });
    if (input.scale !== undefined) {
      const scale =
        typeof input.scale === "object" && "x" in input.scale
          ? input.scale
          : { x: input.scale, y: input.scale };
      push({
        id: bindingId("scale"),
        node: id,
        property: "scale",
        x: expr(scale.x),
        y: expr(scale.y),
      });
    }
    for (const property of ["rotation", "opacity", "depth", "blur"] as const) {
      const value = input[property];
      if (value !== undefined)
        push({ id: bindingId(property), node: id, property, value: expr(value) });
    }
    for (const property of ["fill", "stroke"] as const) {
      const value = input[property];
      if (value !== undefined)
        push({
          id: bindingId(property),
          node: id,
          property,
          from: normalizeColor(value.from),
          to: normalizeColor(value.to),
          progress: expr(value.progress),
        });
    }
  }

  #rule(trigger: EventTriggerIR, actions: readonly EventActionIR[], guard?: ExprInput): void {
    this.rules.push({
      id: `rule-${String(this.rules.length + 1)}`,
      trigger,
      ...(guard === undefined ? {} : { guard: expr(guard) }),
      actions,
    });
  }

  on(
    trigger: EventTriggerIR,
    actions: EventActionIR | readonly EventActionIR[],
    options: Readonly<{ when?: ExprInput }> = {},
  ): void {
    this.#rule(trigger, Array.isArray(actions) ? actions : [actions], options.when);
  }

  sound(id: string, source: string, options: SoundOptions = {}): SoundHandle {
    this.sounds.push({
      id,
      asset: asset(source),
      ...(options.duration === undefined ? {} : { duration: options.duration }),
      trimStart: options.trim?.start ?? sec(0),
      ...(options.trim?.end === undefined ? {} : { trimEnd: options.trim.end }),
      volume: options.volume ?? 1,
      fadeIn: options.fadeIn ?? sec(0),
      fadeOut: options.fadeOut ?? sec(0),
    });
    return { id };
  }
}

export const onClick = (node: NodeLike): EventTriggerIR => ({ kind: "click", node: nodeId(node) });
export const onPointerEnter = (node: NodeLike): EventTriggerIR => ({
  kind: "pointerEnter",
  node: nodeId(node),
});
export const onPointerLeave = (node: NodeLike): EventTriggerIR => ({
  kind: "pointerLeave",
  node: nodeId(node),
});
export const onPointerDown = (node: NodeLike): EventTriggerIR => ({
  kind: "pointerDown",
  node: nodeId(node),
});
export const onPointerUp = (node: NodeLike): EventTriggerIR => ({
  kind: "pointerUp",
  node: nodeId(node),
});
export const onKeyDown = (code: string): EventTriggerIR => ({ kind: "keyDown", code });
export const onKeyUp = (code: string): EventTriggerIR => ({ kind: "keyUp", code });
export const onScroll = (): EventTriggerIR => ({ kind: "scroll" });

export const setState = <T extends SignalValue>(
  state: StateHandle<T>,
  value: ExprInput,
): EventActionIR => ({ kind: "setState", state: state.name, value: expr(value) });
export const toggle = (state: StateHandle<boolean>): EventActionIR => ({
  kind: "toggleState",
  state: state.name,
});
export const playSound = (sound: SoundHandle): EventActionIR => ({
  kind: "playSound",
  sound: sound.id,
});
