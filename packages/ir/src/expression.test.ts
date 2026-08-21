import { describe, expect, it } from "vitest";
import {
  evaluateExpression,
  expressionSignals,
  printExpression,
  typeOfExpression,
  type ReactiveExpr,
  type SignalRef,
  type SignalValueKind,
} from "./index.js";

const constant = (value: number | boolean): ReactiveExpr => ({ kind: "const", value });
const signal = (ref: SignalRef): ReactiveExpr => ({ kind: "signal", ref });
const pointerX = signal({ kind: "pointer", channel: "x" });
const pointerDown = signal({ kind: "pointer", channel: "down" });

const kinds = (ref: SignalRef): SignalValueKind | undefined => {
  if (ref.kind === "pointer")
    return ref.channel === "down" || ref.channel === "present" ? "boolean" : "number";
  if (ref.kind === "scroll" || ref.kind === "viewport") return "number";
  if (ref.kind === "state") return ref.name === "count" ? "number" : "boolean";
  return "boolean";
};

const read = (ref: SignalRef): number | boolean | undefined => {
  if (ref.kind === "pointer") return ref.channel === "down" ? true : 120;
  if (ref.kind === "scroll") return 300;
  if (ref.kind === "state") return ref.name === "count" ? 2 : false;
  return false;
};

describe("reactive expressions", () => {
  it("evaluates arithmetic, comparison, boolean, and conditional nodes", () => {
    const expression: ReactiveExpr = {
      kind: "conditional",
      condition: {
        kind: "and",
        left: pointerDown,
        right: { kind: "gt", left: pointerX, right: constant(100) },
      },
      whenTrue: {
        kind: "add",
        left: constant(1),
        right: { kind: "mul", left: constant(2), right: constant(3) },
      },
      whenFalse: constant(0),
    };

    expect(evaluateExpression(expression, read)).toBe(7);
  });

  it("clamps, interpolates, and refuses to divide by zero", () => {
    expect(
      evaluateExpression(
        { kind: "clamp", value: constant(5), min: constant(0), max: constant(1) },
        read,
      ),
    ).toBe(1);
    expect(
      evaluateExpression(
        { kind: "lerp", from: constant(10), to: constant(20), progress: constant(0.25) },
        read,
      ),
    ).toBe(12.5);
    expect(evaluateExpression({ kind: "div", left: constant(1), right: constant(0) }, read)).toBe(
      0,
    );
  });

  it("resolves an unreadable signal to zero rather than throwing", () => {
    expect(evaluateExpression(pointerX, () => undefined)).toBe(0);
  });

  it("types the vocabulary and rejects mismatched operands", () => {
    expect(typeOfExpression(pointerX, kinds)).toEqual({ ok: true, kind: "number" });
    expect(typeOfExpression({ kind: "not", value: pointerDown }, kinds)).toEqual({
      ok: true,
      kind: "boolean",
    });
    expect(typeOfExpression({ kind: "add", left: pointerX, right: pointerDown }, kinds)).toEqual({
      ok: false,
      detail: "add right must be number, found boolean",
    });
    expect(typeOfExpression({ kind: "lt", left: pointerDown, right: pointerDown }, kinds)).toEqual({
      ok: false,
      detail: "lt requires number operands",
    });
    expect(
      typeOfExpression(
        {
          kind: "conditional",
          condition: pointerDown,
          whenTrue: constant(1),
          whenFalse: constant(true),
        },
        kinds,
      ),
    ).toEqual({ ok: false, detail: "conditional branches differ: number and boolean" });
  });

  it("reports an unknown signal instead of inferring a type", () => {
    expect(typeOfExpression(signal({ kind: "hover", node: "card" }), () => undefined)).toEqual({
      ok: false,
      detail: "unknown signal `hover.card`",
    });
  });

  it("lists referenced signals once, in first-seen order", () => {
    const expression: ReactiveExpr = {
      kind: "add",
      left: { kind: "add", left: pointerX, right: signal({ kind: "scroll", channel: "y" }) },
      right: pointerX,
    };

    expect(expressionSignals(expression).map((ref) => ref.kind)).toEqual(["pointer", "scroll"]);
  });

  it("prints an expression back as readable source", () => {
    expect(
      printExpression({
        kind: "conditional",
        condition: signal({ kind: "hover", node: "card" }),
        whenTrue: constant(1.05),
        whenFalse: constant(1),
      }),
    ).toBe("hover(card) ? 1.05 : 1");
    expect(
      printExpression({
        kind: "clamp",
        value: {
          kind: "sub",
          left: constant(1),
          right: {
            kind: "div",
            left: signal({ kind: "scroll", channel: "y" }),
            right: constant(300),
          },
        },
        min: constant(0),
        max: constant(1),
      }),
    ).toBe("clamp((1 - (scroll.y / 300)), 0, 1)");
  });
});
