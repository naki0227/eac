import {
  evaluateExpression,
  type ColorIR,
  type NodeOverride,
  type ReactiveBindingIR,
  type ReactiveOverrides,
  type ReactiveSceneIR,
  type SignalReader,
  type SignalRef,
  type SignalValue,
} from "@eac/ir";
import type { ReplayState } from "./state.js";

const asNumber = (value: SignalValue): number =>
  typeof value === "boolean" ? (value ? 1 : 0) : value;

export function signalReader(state: ReplayState): SignalReader {
  const keys = new Set(state.keys);
  return (ref: SignalRef): SignalValue | undefined => {
    switch (ref.kind) {
      case "pointer":
        if (ref.channel === "x") return Number.isFinite(state.pointer.x) ? state.pointer.x : 0;
        if (ref.channel === "y") return Number.isFinite(state.pointer.y) ? state.pointer.y : 0;
        if (ref.channel === "down") return state.pointer.down;
        return state.pointer.present;
      case "scroll":
        return ref.channel === "x" ? state.scroll.x : state.scroll.y;
      case "key":
        return keys.has(ref.code);
      case "hover":
        return state.hoverTarget === ref.node;
      case "pressed":
        return state.pressedTarget === ref.node;
      case "state":
        return state.states[ref.name];
      default:
        return undefined;
    }
  };
}

const mixColor = (from: ColorIR, to: ColorIR, progress: number): ColorIR => {
  const clamped = Math.min(1, Math.max(0, progress));
  const channel = (a: number, b: number): number => a + (b - a) * clamped;
  return {
    kind: "color",
    red: channel(from.red, to.red),
    green: channel(from.green, to.green),
    blue: channel(from.blue, to.blue),
    alpha: channel(from.alpha, to.alpha),
  };
};

function applyBinding(
  target: Record<string, unknown>,
  binding: ReactiveBindingIR,
  read: SignalReader,
): void {
  if (binding.property === "position" || binding.property === "scale") {
    target[binding.property] = {
      x: asNumber(evaluateExpression(binding.x, read)),
      y: asNumber(evaluateExpression(binding.y, read)),
    };
    return;
  }
  if ("value" in binding) {
    target[binding.property] = asNumber(evaluateExpression(binding.value, read));
    return;
  }
  target[binding.property] = mixColor(
    binding.from,
    binding.to,
    asNumber(evaluateExpression(binding.progress, read)),
  );
}

/**
 * Reactive output for one committed state. Recomputed once per step; an empty binding set yields an
 * empty map so non-reactive scenes evaluate exactly as they did in v0.2.
 */
export function computeOverrides(reactive: ReactiveSceneIR, state: ReplayState): ReactiveOverrides {
  if (reactive.bindings.length === 0) return new Map();
  const read = signalReader(state);
  const overrides = new Map<string, Record<string, unknown>>();
  for (const binding of reactive.bindings) {
    const target = overrides.get(binding.node) ?? {};
    applyBinding(target, binding, read);
    overrides.set(binding.node, target);
  }
  return new Map([...overrides].map(([node, values]) => [node, values as NodeOverride] as const));
}
