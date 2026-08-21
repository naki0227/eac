import { describe, expect, it } from "vitest";
import { experience, opacity, px, sec } from "./index.js";

describe("EaC DSL", () => {
  it("builds deterministic IR with timed motion", () => {
    const project = experience({ name: "demo", width: px(640), height: px(360), duration: sec(5) });
    const scene = project.scene("main");
    scene
      .circle("dot", { position: { x: px(10), y: px(20) }, radius: px(8), fill: "#fff" })
      .moveTo({ x: px(100), y: px(20) }, { at: sec(1), duration: sec(2) })
      .fadeTo(opacity(0), { at: sec(3), duration: sec(1) });
    expect(project.build().scenes[0]?.objects[0]?.properties.position.segments).toHaveLength(1);
    expect(project.build()).toEqual(project.build());
  });
});
