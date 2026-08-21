import { describe, expect, it } from "vitest";
import { deg, px } from "@eac/units";
import { isValidTrajectory } from "./trajectory-rules.js";

describe("trajectory rules", () => {
  it("accepts fully specified deterministic path geometry", () => {
    expect(
      isValidTrajectory({
        kind: "ellipse",
        center: { x: px(10), y: px(20) },
        radiusX: px(10),
        radiusY: px(5),
        rotation: deg(20),
        startAngle: deg(0),
        endAngle: deg(180),
      }),
    ).toBe(true);
  });

  it("rejects non-finite and degenerate path geometry", () => {
    expect(
      isValidTrajectory({
        kind: "orbit",
        center: { x: px(0), y: px(0) },
        radius: { kind: "length", value: Infinity },
        startAngle: deg(0),
        turns: 1,
      }),
    ).toBe(false);
    expect(
      isValidTrajectory({
        kind: "wave",
        start: { x: px(0), y: px(0) },
        end: { x: px(0), y: px(0) },
        amplitude: px(10),
        cycles: 1,
        phase: deg(0),
      }),
    ).toBe(false);
    expect(
      isValidTrajectory({
        kind: "spiral",
        center: { x: px(0), y: px(0) },
        startRadius: px(0),
        endRadius: px(0),
        turns: 1,
        startAngle: deg(0),
      }),
    ).toBe(false);
  });
});
