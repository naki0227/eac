import { describe, expect, it } from "vitest";
import { evaluateScene, transformPoint } from "@eac/ir";
import { deg, depth, experience, opacity, px, sec } from "./index.js";

describe("Group DSL", () => {
  it("preserves nested local coordinates and composes opacity and depth", () => {
    const project = experience({
      name: "groups",
      width: px(400),
      height: px(400),
      duration: sec(2),
    });
    const scene = project.scene("main");
    const outer = scene.group("outer", {
      position: { x: px(100), y: px(100) },
      rotation: deg(90),
      scale: 2,
      opacity: opacity(0.5),
      depth: depth(10),
    });
    const inner = outer.group("inner", {
      position: { x: px(10), y: px(0) },
      opacity: opacity(0.5),
      depth: depth(20),
    });
    inner.circle("dot", {
      position: { x: px(5), y: px(0) },
      radius: px(2),
      fill: "red",
      opacity: opacity(0.5),
      depth: depth(30),
    });

    const sceneIr = project.build().scenes[0];
    if (!sceneIr) throw new Error("Expected scene in test fixture.");
    const evaluated = evaluateScene(sceneIr, 0)[0];
    if (!evaluated) throw new Error("Expected evaluated child in test fixture.");
    const [x, y] = transformPoint(evaluated.matrix, 0, 0);
    expect(x).toBeCloseTo(100, 10);
    expect(y).toBeCloseTo(130, 10);
    expect(evaluated.opacity).toBe(0.125);
    expect(evaluated.depth).toBe(60);
  });

  it("animates a group transform without changing child-local properties", () => {
    const project = experience({
      name: "motion",
      width: px(300),
      height: px(200),
      duration: sec(1),
    });
    const scene = project.scene("main");
    const group = scene.group("card", { position: { x: px(0), y: px(0) } });
    const dot = group.circle("dot", {
      position: { x: px(10), y: px(0) },
      radius: px(2),
      fill: "red",
    });
    group.moveTo({ x: px(100), y: px(0) }, { at: sec(0), duration: sec(1) });

    const sceneIr = project.build().scenes[0];
    if (!sceneIr) throw new Error("Expected scene in test fixture.");
    const evaluated = evaluateScene(sceneIr, 0.5)[0];
    if (!evaluated) throw new Error("Expected evaluated child in test fixture.");
    expect(transformPoint(evaluated.matrix, 0, 0)).toEqual([60, 0]);
    expect(dot.ir.properties.position.initial).toEqual({ x: px(10), y: px(0) });
  });
});
