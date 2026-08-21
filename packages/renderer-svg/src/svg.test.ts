import { describe, expect, it } from "vitest";
import { depth, experience, px, sec } from "@eac/core";
import { renderPng, renderSvg } from "./index.js";

describe("SVG renderer", () => {
  it("is deterministic, escapes content, and sorts by depth", () => {
    const project = experience({
      name: "render",
      width: px(100),
      height: px(100),
      duration: sec(1),
    });
    const scene = project.scene("main");
    scene.text("front", "<&", {
      position: { x: px(10), y: px(10) },
      fontSize: px(12),
      fill: "white",
      depth: depth(10),
    });
    scene.circle("back", {
      position: { x: px(20), y: px(20) },
      radius: px(4),
      fill: "black",
      depth: depth(-10),
    });
    const first = renderSvg(project.build(), 0);
    expect(first).toBe(renderSvg(project.build(), 0));
    expect(first.indexOf('id="back"')).toBeLessThan(first.indexOf('id="front"'));
    expect(first).toContain("&lt;&amp;");
  });

  it("renders a PNG frame", () => {
    const project = experience({ name: "png", width: px(16), height: px(16), duration: sec(1) });
    project
      .scene("main")
      .circle("dot", { position: { x: px(8), y: px(8) }, radius: px(4), fill: "red" });
    const png = renderPng(project.build(), 0);
    expect([...png.slice(1, 4)]).toEqual([80, 78, 71]);
  });

  it("renders non-uniform scale as an explicit transform", () => {
    const project = experience({
      name: "scale",
      width: px(100),
      height: px(100),
      duration: sec(1),
    });
    project.scene("main").rect("card", {
      position: { x: px(50), y: px(50) },
      width: px(20),
      height: px(10),
      fill: "red",
      scale: { x: 2, y: 0.5 },
    });

    expect(renderSvg(project.build(), 0)).toContain("scale(2 0.5)");
  });
});
