import { describe, expect, it } from "vitest";
import { applyEasing, isValidEasing } from "./index.js";

describe("deterministic easing", () => {
  it("evaluates named easing directly at arbitrary progress", () => {
    expect(applyEasing({ kind: "linear" }, 0.25)).toBe(0.25);
    expect(applyEasing({ kind: "ease-in" }, 0.5)).toBe(0.25);
    expect(applyEasing({ kind: "ease-out" }, 0.5)).toBe(0.75);
    expect(applyEasing({ kind: "ease-in-out" }, 0.25)).toBe(0.125);
    expect(applyEasing({ kind: "ease-in-out" }, 0.75)).toBe(0.875);
  });

  it("solves cubic bezier deterministically and preserves endpoints", () => {
    const curve = { kind: "cubic-bezier" as const, x1: 0.42, y1: 0, x2: 0.58, y2: 1 };
    expect(applyEasing(curve, 0)).toBe(0);
    expect(applyEasing(curve, 0.5)).toBeCloseTo(0.5, 6);
    expect(applyEasing(curve, 1)).toBe(1);
    expect(applyEasing(curve, 0.375)).toBe(applyEasing(curve, 0.375));
  });

  it("rejects non-finite and out-of-range cubic bezier x values", () => {
    expect(isValidEasing({ kind: "cubic-bezier", x1: -0.1, y1: 0, x2: 1, y2: 1 })).toBe(false);
    expect(isValidEasing({ kind: "cubic-bezier", x1: 0, y1: 0, x2: Infinity, y2: 1 })).toBe(false);
  });
});
