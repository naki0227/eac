import { describe, expect, it } from "vitest";
import { deg, experience, px, sec, trajectory } from "./index.js";
import { evaluateTimedProperty } from "@eac/ir";

describe("trajectory DSL", () => {
  it("follows an absolute path as one position writer", () => {
    const project = experience({ name: "path", width: px(200), height: px(200), duration: sec(3) });
    const dot = project
      .scene("main")
      .circle("dot", { position: { x: px(0), y: px(0) }, radius: px(4), fill: "red" });
    dot.followPath(
      trajectory.ellipse({
        center: { x: px(100), y: px(100) },
        radiusX: px(40),
        radiusY: px(20),
        startAngle: deg(0),
        endAngle: deg(180),
      }),
      { at: sec(1), duration: sec(2) },
    );

    expect(dot.ir.properties.position.segments).toHaveLength(1);
    expect(evaluateTimedProperty(dot.ir.properties.position, 2)).toEqual({
      x: px(100),
      y: px(120),
    });
  });

  it("rejects degenerate constructor inputs", () => {
    expect(() =>
      trajectory.wave({
        start: { x: px(0), y: px(0) },
        end: { x: px(0), y: px(0) },
        amplitude: px(10),
      }),
    ).toThrow("distinct start and end");
    expect(() =>
      trajectory.spiral({
        center: { x: px(0), y: px(0) },
        startRadius: px(0),
        endRadius: px(0),
      }),
    ).toThrow("non-zero radius");
  });
});
