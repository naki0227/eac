import { describe, expect, it } from "vitest";
import { deg, px, sec, type Angle } from "@eac/units";
import { evaluateTimedProperty, type ColorIR, type TimedProperty, type Vec2 } from "./index.js";

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

  it("applies easing without replaying earlier frames", () => {
    const property: TimedProperty<Angle> = {
      kind: "timed",
      initial: deg(0),
      segments: [
        {
          id: "turn",
          start: sec(1),
          duration: sec(2),
          target: deg(100),
          easing: { kind: "ease-in" },
        },
      ],
    };
    expect(evaluateTimedProperty(property, 2)).toEqual(deg(25));
    expect(evaluateTimedProperty(property, 3)).toEqual(deg(100));
  });

  it("interpolates normalized sRGB channels deterministically", () => {
    const property: TimedProperty<ColorIR> = {
      kind: "timed",
      initial: { kind: "color", red: 1, green: 0, blue: 0, alpha: 1 },
      segments: [
        {
          id: "color",
          start: sec(0),
          duration: sec(2),
          target: { kind: "color", red: 0, green: 0, blue: 1, alpha: 0.5 },
        },
      ],
    };
    expect(evaluateTimedProperty(property, 1)).toEqual({
      kind: "color",
      red: 0.5,
      green: 0,
      blue: 0.5,
      alpha: 0.75,
    });
  });
});
