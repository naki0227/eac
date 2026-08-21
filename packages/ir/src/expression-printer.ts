import { signalKey } from "./expression.js";
import type { ReactiveExpr, SignalRef } from "./reactive-types.js";

const INFIX: Readonly<Record<string, string>> = {
  add: "+",
  sub: "-",
  mul: "*",
  div: "/",
  eq: "==",
  neq: "!=",
  lt: "<",
  lte: "<=",
  gt: ">",
  gte: ">=",
  and: "&&",
  or: "||",
};

export const printSignal = (ref: SignalRef): string => {
  if (ref.kind === "key") return `key("${ref.code}")`;
  if (ref.kind === "hover") return `hover(${ref.node})`;
  if (ref.kind === "pressed") return `pressed(${ref.node})`;
  if (ref.kind === "state") return `state(${ref.name})`;
  return signalKey(ref);
};

const number = (value: number): string => Number(value.toFixed(6)).toString();

/** Renders an expression back into readable source-like text for diagnostics and `inspect`. */
export function printExpression(expression: ReactiveExpr): string {
  const print = printExpression;
  switch (expression.kind) {
    case "const":
      return typeof expression.value === "boolean"
        ? String(expression.value)
        : number(expression.value);
    case "signal":
      return printSignal(expression.ref);
    case "neg":
      return `-${print(expression.value)}`;
    case "not":
      return `!${print(expression.value)}`;
    case "min":
    case "max":
      return `${expression.kind}(${print(expression.left)}, ${print(expression.right)})`;
    case "conditional":
      return `${print(expression.condition)} ? ${print(expression.whenTrue)} : ${print(expression.whenFalse)}`;
    case "clamp":
      return `clamp(${print(expression.value)}, ${print(expression.min)}, ${print(expression.max)})`;
    case "lerp":
      return `lerp(${print(expression.from)}, ${print(expression.to)}, ${print(expression.progress)})`;
    default: {
      const operator = INFIX[expression.kind] ?? expression.kind;
      return `(${print(expression.left)} ${operator} ${print(expression.right)})`;
    }
  }
}
