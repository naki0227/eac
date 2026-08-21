import { describe, expect, it } from "vitest";
import { px, sec } from "@eac/units";
import { evaluateTimedProperty, type TimedProperty, type Vec2 } from "./index.js";

describe("evaluateTimedProperty", () => {
  it("seeks directly and inherits the previous target", () => {
    const property: TimedProperty<Vec2> = {
      kind: "timed",
      initial: { x: px(0), y: px(0) },
      segments: [
        { id: "first", start: sec(1), duration: sec(1), target: { x: px(100), y: px(0) } },
        { id: "second", start: sec(3), duration: sec(1), target: { x: px(200), y: px(0) } },
      ],
    };
    expect(evaluateTimedProperty(property, 3.5).x.value).toBe(150);
    expect(evaluateTimedProperty(property, 0).x.value).toBe(0);
  });

  it("evaluates cubic bezier and cycloid trajectories deterministically", () => {
    const base = { kind: "timed" as const, initial: { x: px(0), y: px(0) } };
    const bezier: TimedProperty<Vec2> = {
      ...base,
      segments: [
        {
          id: "b",
          start: sec(0),
          duration: sec(2),
          target: { x: px(100), y: px(0) },
          trajectory: {
            kind: "bezier",
            control1: { x: px(0), y: px(100) },
            control2: { x: px(100), y: px(100) },
          },
        },
      ],
    };
    const cycloid: TimedProperty<Vec2> = {
      ...base,
      segments: [
        {
          id: "c",
          start: sec(0),
          duration: sec(2),
          target: { x: px(100), y: px(0) },
          trajectory: { kind: "cycloid", radius: px(20) },
        },
      ],
    };
    expect(evaluateTimedProperty(bezier, 1)).toEqual({ x: px(50), y: px(75) });
    expect(evaluateTimedProperty(cycloid, 1)).toEqual(evaluateTimedProperty(cycloid, 1));
    expect(evaluateTimedProperty(cycloid, 2)).toEqual({ x: px(100), y: px(0) });
  });
});
