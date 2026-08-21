import type { ReactiveExpr, SignalRef } from "@eac/ir";

/**
 * Every helper here is a constructor that returns inert IR. Nothing captures a closure, so a
 * binding written in TypeScript serializes, prints, and type-checks like data. See ADR 0008.
 */
export type ExprInput = ReactiveExpr | number | boolean;

export const expr = (value: ExprInput): ReactiveExpr =>
  typeof value === "number" || typeof value === "boolean" ? { kind: "const", value } : value;

const signal = (ref: SignalRef): ReactiveExpr => ({ kind: "signal", ref });

export const pointer = Object.freeze({
  x: signal({ kind: "pointer", channel: "x" }),
  y: signal({ kind: "pointer", channel: "y" }),
  down: signal({ kind: "pointer", channel: "down" }),
  present: signal({ kind: "pointer", channel: "present" }),
});

export const scroll = Object.freeze({
  x: signal({ kind: "scroll", channel: "x" }),
  y: signal({ kind: "scroll", channel: "y" }),
});

export const viewport = Object.freeze({
  width: signal({ kind: "viewport", channel: "width" }),
  height: signal({ kind: "viewport", channel: "height" }),
});

export const key = (code: string): ReactiveExpr => signal({ kind: "key", code });

type NodeLike = string | Readonly<{ ir: Readonly<{ id: string }> }>;
export const nodeId = (node: NodeLike): string => (typeof node === "string" ? node : node.ir.id);

export const hover = (node: NodeLike): ReactiveExpr =>
  signal({ kind: "hover", node: nodeId(node) });
export const pressed = (node: NodeLike): ReactiveExpr =>
  signal({ kind: "pressed", node: nodeId(node) });

const binary =
  (kind: "add" | "sub" | "mul" | "div" | "min" | "max") =>
  (left: ExprInput, right: ExprInput): ReactiveExpr => ({
    kind,
    left: expr(left),
    right: expr(right),
  });

export const add = binary("add");
export const sub = binary("sub");
export const mul = binary("mul");
export const div = binary("div");
export const min = binary("min");
export const max = binary("max");
export const neg = (value: ExprInput): ReactiveExpr => ({ kind: "neg", value: expr(value) });

const compare =
  (kind: "eq" | "neq" | "lt" | "lte" | "gt" | "gte") =>
  (left: ExprInput, right: ExprInput): ReactiveExpr => ({
    kind,
    left: expr(left),
    right: expr(right),
  });

export const equals = compare("eq");
export const notEquals = compare("neq");
export const lessThan = compare("lt");
export const atMost = compare("lte");
export const greaterThan = compare("gt");
export const atLeast = compare("gte");

export const and = (left: ExprInput, right: ExprInput): ReactiveExpr => ({
  kind: "and",
  left: expr(left),
  right: expr(right),
});
export const or = (left: ExprInput, right: ExprInput): ReactiveExpr => ({
  kind: "or",
  left: expr(left),
  right: expr(right),
});
export const not = (value: ExprInput): ReactiveExpr => ({ kind: "not", value: expr(value) });

export const when = (
  condition: ExprInput,
  whenTrue: ExprInput,
  whenFalse: ExprInput,
): ReactiveExpr => ({
  kind: "conditional",
  condition: expr(condition),
  whenTrue: expr(whenTrue),
  whenFalse: expr(whenFalse),
});

export const clamp = (value: ExprInput, low: ExprInput = 0, high: ExprInput = 1): ReactiveExpr => ({
  kind: "clamp",
  value: expr(value),
  min: expr(low),
  max: expr(high),
});

export const lerp = (from: ExprInput, to: ExprInput, progress: ExprInput): ReactiveExpr => ({
  kind: "lerp",
  from: expr(from),
  to: expr(to),
  progress: expr(progress),
});
