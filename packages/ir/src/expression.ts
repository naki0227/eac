import type { ReactiveExpr, SignalRef, SignalValue, SignalValueKind } from "./reactive-types.js";

export type SignalReader = (ref: SignalRef) => SignalValue | undefined;

const NUMBER_OPERATORS = ["add", "sub", "mul", "div", "min", "max"] as const;
const isNumberOperator = (kind: string): boolean =>
  (NUMBER_OPERATORS as readonly string[]).includes(kind);

export function signalKey(ref: SignalRef): string {
  if (ref.kind === "key") return `key.${ref.code}`;
  if (ref.kind === "hover") return `hover.${ref.node}`;
  if (ref.kind === "pressed") return `pressed.${ref.node}`;
  if (ref.kind === "state") return `state.${ref.name}`;
  return `${ref.kind}.${ref.channel}`;
}

/**
 * Every signal reference an expression reads, in stable first-seen order.
 *
 * Raw IR can contain a self-referential expression graph, so every traversal in this module tracks
 * the active path and stops rather than recursing without end. The checker reports the cycle; these
 * functions stay total so no consumer can crash on one.
 */
export function expressionSignals(expression: ReactiveExpr): readonly SignalRef[] {
  const found: SignalRef[] = [];
  const seen = new Set<string>();
  const active = new Set<ReactiveExpr>();
  const visit = (node: ReactiveExpr): void => {
    if (active.has(node)) return;
    active.add(node);
    if (node.kind === "signal") {
      active.delete(node);
      const key = signalKey(node.ref);
      if (!seen.has(key)) {
        seen.add(key);
        found.push(node.ref);
      }
      return;
    }
    for (const child of expressionChildren(node)) visit(child);
    active.delete(node);
  };
  visit(expression);
  return found;
}

export function expressionChildren(expression: ReactiveExpr): readonly ReactiveExpr[] {
  if (expression.kind === "const" || expression.kind === "signal") return [];
  if (expression.kind === "neg" || expression.kind === "not") return [expression.value];
  if (expression.kind === "conditional")
    return [expression.condition, expression.whenTrue, expression.whenFalse];
  if (expression.kind === "clamp") return [expression.value, expression.min, expression.max];
  if (expression.kind === "lerp") return [expression.from, expression.to, expression.progress];
  return [expression.left, expression.right];
}

export type TypeResult =
  Readonly<{ ok: true; kind: SignalValueKind }> | Readonly<{ ok: false; detail: string }>;

const ok = (kind: SignalValueKind): TypeResult => ({ ok: true, kind });
const fail = (detail: string): TypeResult => ({ ok: false, detail });

/**
 * Total static typing over the closed expression vocabulary. Signal kinds come from the caller so
 * that state declarations and node-scoped signals can be resolved before typing runs.
 */
export function typeOfExpression(
  expression: ReactiveExpr,
  signalKind: (ref: SignalRef) => SignalValueKind | undefined,
  active: ReadonlySet<ReactiveExpr> = new Set(),
): TypeResult {
  if (active.has(expression)) return fail("expression refers to itself");
  const path = new Set([...active, expression]);
  const child = (node: ReactiveExpr): TypeResult => typeOfExpression(node, signalKind, path);
  const expect = (node: ReactiveExpr, kind: SignalValueKind, label: string): string | undefined => {
    const result = child(node);
    if (!result.ok) return result.detail;
    return result.kind === kind ? undefined : `${label} must be ${kind}, found ${result.kind}`;
  };

  if (expression.kind === "const")
    return ok(typeof expression.value === "boolean" ? "boolean" : "number");
  if (expression.kind === "signal") {
    const kind = signalKind(expression.ref);
    return kind === undefined ? fail(`unknown signal \`${signalKey(expression.ref)}\``) : ok(kind);
  }
  if (expression.kind === "neg") {
    const detail = expect(expression.value, "number", "neg operand");
    return detail === undefined ? ok("number") : fail(detail);
  }
  if (expression.kind === "not") {
    const detail = expect(expression.value, "boolean", "not operand");
    return detail === undefined ? ok("boolean") : fail(detail);
  }
  if (expression.kind === "and" || expression.kind === "or") {
    const detail =
      expect(expression.left, "boolean", `${expression.kind} left`) ??
      expect(expression.right, "boolean", `${expression.kind} right`);
    return detail === undefined ? ok("boolean") : fail(detail);
  }
  if (expression.kind === "clamp") {
    const detail =
      expect(expression.value, "number", "clamp value") ??
      expect(expression.min, "number", "clamp min") ??
      expect(expression.max, "number", "clamp max");
    return detail === undefined ? ok("number") : fail(detail);
  }
  if (expression.kind === "lerp") {
    const detail =
      expect(expression.from, "number", "lerp from") ??
      expect(expression.to, "number", "lerp to") ??
      expect(expression.progress, "number", "lerp progress");
    return detail === undefined ? ok("number") : fail(detail);
  }
  if (expression.kind === "conditional") {
    const conditionDetail = expect(expression.condition, "boolean", "conditional condition");
    if (conditionDetail !== undefined) return fail(conditionDetail);
    const whenTrue = child(expression.whenTrue);
    const whenFalse = child(expression.whenFalse);
    if (!whenTrue.ok) return whenTrue;
    if (!whenFalse.ok) return whenFalse;
    return whenTrue.kind === whenFalse.kind
      ? ok(whenTrue.kind)
      : fail(`conditional branches differ: ${whenTrue.kind} and ${whenFalse.kind}`);
  }
  if (isNumberOperator(expression.kind)) {
    const detail =
      expect(expression.left, "number", `${expression.kind} left`) ??
      expect(expression.right, "number", `${expression.kind} right`);
    return detail === undefined ? ok("number") : fail(detail);
  }
  const left = child(expression.left);
  const right = child(expression.right);
  if (!left.ok) return left;
  if (!right.ok) return right;
  if (left.kind !== right.kind)
    return fail(`${expression.kind} compares ${left.kind} with ${right.kind}`);
  if (left.kind === "boolean" && expression.kind !== "eq" && expression.kind !== "neq")
    return fail(`${expression.kind} requires number operands`);
  return ok("boolean");
}

const asNumber = (value: SignalValue): number => (typeof value === "boolean" ? 0 : value);
const asBoolean = (value: SignalValue): boolean => value === true;

/**
 * Evaluation is total: an unreadable signal resolves to its type's zero value rather than throwing,
 * because the checker has already reported the reference and rendering must not crash.
 */
export function evaluateExpression(
  expression: ReactiveExpr,
  read: SignalReader,
  active: ReadonlySet<ReactiveExpr> = new Set(),
): SignalValue {
  if (active.has(expression)) return 0;
  const path = new Set([...active, expression]);
  const value = (node: ReactiveExpr): SignalValue => evaluateExpression(node, read, path);
  const number = (node: ReactiveExpr): number => asNumber(value(node));
  const boolean = (node: ReactiveExpr): boolean => asBoolean(value(node));

  switch (expression.kind) {
    case "const":
      return expression.value;
    case "signal":
      return read(expression.ref) ?? 0;
    case "add":
      return number(expression.left) + number(expression.right);
    case "sub":
      return number(expression.left) - number(expression.right);
    case "mul":
      return number(expression.left) * number(expression.right);
    case "div": {
      const divisor = number(expression.right);
      return divisor === 0 ? 0 : number(expression.left) / divisor;
    }
    case "min":
      return Math.min(number(expression.left), number(expression.right));
    case "max":
      return Math.max(number(expression.left), number(expression.right));
    case "neg":
      return -number(expression.value);
    case "eq":
      return value(expression.left) === value(expression.right);
    case "neq":
      return value(expression.left) !== value(expression.right);
    case "lt":
      return number(expression.left) < number(expression.right);
    case "lte":
      return number(expression.left) <= number(expression.right);
    case "gt":
      return number(expression.left) > number(expression.right);
    case "gte":
      return number(expression.left) >= number(expression.right);
    case "and":
      return boolean(expression.left) && boolean(expression.right);
    case "or":
      return boolean(expression.left) || boolean(expression.right);
    case "not":
      return !boolean(expression.value);
    case "conditional":
      return boolean(expression.condition)
        ? value(expression.whenTrue)
        : value(expression.whenFalse);
    case "clamp":
      return Math.min(
        Math.max(number(expression.value), number(expression.min)),
        number(expression.max),
      );
    default: {
      const from = number(expression.from);
      return from + (number(expression.to) - from) * number(expression.progress);
    }
  }
}
