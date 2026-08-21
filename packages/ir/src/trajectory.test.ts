import { describe, expect, it } from "vitest";
import { deg, px } from "@eac/units";
import { evaluatePathTrajectory, type PathTrajectory } from "./index.js";

describe("path trajectories", () => {
  it("evaluates ellipse, orbit, and spiral from normalized progress", () => {
    const ellipse: PathTrajectory = {
      kind: "ellipse",
      center: { x: px(100), y: px(100) },
      radiusX: px(40),
      radiusY: px(20),
      rotation: deg(0),
      startAngle: deg(0),
      endAngle: deg(180),
    };
    expect(evaluatePathTrajectory(ellipse, 0)).toEqual({ x: px(140), y: px(100) });
    expect(evaluatePathTrajectory(ellipse, 0.5).x.value).toBeCloseTo(100, 10);
    expect(evaluatePathTrajectory(ellipse, 0.5).y.value).toBeCloseTo(120, 10);

    const orbit: PathTrajectory = {
      kind: "orbit",
      center: { x: px(0), y: px(0) },
      radius: px(10),
      startAngle: deg(90),
      turns: 1,
    };
    expect(evaluatePathTrajectory(orbit, 0).y.value).toBeCloseTo(10, 10);

    const spiral: PathTrajectory = {
      kind: "spiral",
      center: { x: px(0), y: px(0) },
      startRadius: px(0),
      endRadius: px(20),
      turns: 1,
      startAngle: deg(0),
    };
    expect(evaluatePathTrajectory(spiral, 1).x.value).toBeCloseTo(20, 10);
  });

  it("evaluates a wave perpendicular to its baseline", () => {
    const wave: PathTrajectory = {
      kind: "wave",
      start: { x: px(0), y: px(0) },
      end: { x: px(100), y: px(0) },
      amplitude: px(10),
      cycles: 1,
      phase: deg(0),
    };
    expect(evaluatePathTrajectory(wave, 0.25)).toEqual({ x: px(25), y: px(10) });
    expect(evaluatePathTrajectory(wave, 1).x.value).toBe(100);
    expect(evaluatePathTrajectory(wave, 1).y.value).toBeCloseTo(0, 10);
  });
});
