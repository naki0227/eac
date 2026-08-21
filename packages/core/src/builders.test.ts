import { describe, expect, it } from "vitest";
import { deg, easing, experience, opacity, px, sec } from "./index.js";

describe("EaC DSL", () => {
  it("builds deterministic IR with timed motion", () => {
    const project = experience({ name: "demo", width: px(640), height: px(360), duration: sec(5) });
    const scene = project.scene("main");
    scene
      .circle("dot", { position: { x: px(10), y: px(20) }, radius: px(8), fill: "#fff" })
      .moveTo({ x: px(100), y: px(20) }, { at: sec(1), duration: sec(2) })
      .fadeTo(opacity(0), { at: sec(3), duration: sec(1) });
    expect(project.build().scenes[0]?.nodes[0]?.properties.position.segments).toHaveLength(1);
    expect(project.build()).toEqual(project.build());
  });

  it("normalizes relative motion from state at its start independent of call order", () => {
    const project = experience({
      name: "relative",
      width: px(640),
      height: px(360),
      duration: sec(5),
    });
    const dot = project
      .scene("main")
      .circle("dot", { position: { x: px(10), y: px(20) }, radius: px(8), fill: "#fff" });

    dot
      .moveBy({ x: px(25), y: px(-5) }, { at: sec(3), duration: sec(1) })
      .rotateBy(deg(90), { at: sec(3), duration: sec(1) })
      .scaleBy(0.2, { at: sec(3), duration: sec(1), easing: easing.easeOut })
      .moveTo({ x: px(100), y: px(50) }, { at: sec(1), duration: sec(1) })
      .rotateTo(deg(180), { at: sec(1), duration: sec(1) })
      .scaleTo(1.5, { at: sec(1), duration: sec(1) });

    const properties = dot.ir.properties;
    expect(properties.position.segments.map(({ target }) => target)).toEqual([
      { x: px(100), y: px(50) },
      { x: px(125), y: px(45) },
    ]);
    expect(properties.rotation.segments.map(({ target }) => target)).toEqual([deg(180), deg(270)]);
    expect(properties.scale.segments.map(({ target }) => target)).toEqual([
      { kind: "scale", x: 1.5, y: 1.5 },
      { kind: "scale", x: 1.7, y: 1.7 },
    ]);
    expect(properties.scale.segments[1]?.easing).toEqual(easing.easeOut);
  });

  it("supports non-uniform initial and target scale", () => {
    const project = experience({
      name: "scale",
      width: px(640),
      height: px(360),
      duration: sec(2),
    });
    const node = project.scene("main").rect("card", {
      position: { x: px(100), y: px(100) },
      width: px(80),
      height: px(40),
      fill: "#fff",
      scale: { x: 1, y: 0.5 },
    });
    node.scaleTo({ x: 2, y: 1 }, { at: sec(0), duration: sec(1) });
    expect(node.ir.properties.scale.initial).toEqual({ kind: "scale", x: 1, y: 0.5 });
    expect(node.ir.properties.scale.segments[0]?.target).toEqual({ kind: "scale", x: 2, y: 1 });
  });

  it("normalizes a timed local audio clip", () => {
    const project = experience({
      name: "audio",
      width: px(100),
      height: px(100),
      duration: sec(3),
    });
    project.scene("main").audio("assets/click.wav", {
      id: "click",
      at: sec(1.2),
      trim: { start: sec(0.1), end: sec(0.6) },
      volume: 0.8,
      fadeIn: sec(0.05),
      fadeOut: sec(0.1),
    });

    expect(project.build().scenes[0]?.audioClips).toEqual([
      expect.objectContaining({
        id: "click",
        asset: { kind: "local", path: "assets/click.wav" },
        start: sec(1.2),
        trimStart: sec(0.1),
        trimEnd: sec(0.6),
        volume: 0.8,
      }),
    ]);
  });
});
