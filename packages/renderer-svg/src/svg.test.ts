import { describe, expect, it } from "vitest";
import { depth, experience, opacity, px, sec } from "@eac/core";
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

    expect(renderSvg(project.build(), 0)).toContain('transform="matrix(2 0 0 0.5 50 50)"');
  });

  it("lowers nested group transforms and opacity to evaluated leaf SVG", () => {
    const project = experience({
      name: "group",
      width: px(100),
      height: px(100),
      duration: sec(1),
    });
    const group = project.scene("main").group("parent", {
      position: { x: px(40), y: px(50) },
      scale: 2,
      opacity: opacity(0.5),
    });
    group.circle("dot", {
      position: { x: px(10), y: px(0) },
      radius: px(4),
      fill: "red",
      opacity: opacity(0.5),
    });

    const svg = renderSvg(project.build(), 0);
    expect(svg).toContain('id="dot" transform="matrix(2 0 0 2 60 50)" opacity="0.25"');
    expect(svg).not.toContain('id="parent"');
  });

  it("renders normalized color, text attributes, blur, and shadow structurally", () => {
    const project = experience({
      name: "style",
      width: px(200),
      height: px(100),
      duration: sec(1),
    });
    project.scene("main").text("title", "Styled", {
      position: { x: px(100), y: px(50) },
      fontSize: px(24),
      fontFamily: "Inter & Friends",
      fontWeight: 700,
      textAlign: "middle",
      letterSpacing: px(2),
      fill: "#336699cc",
      stroke: "white",
      strokeWidth: px(2),
      blur: px(1),
      shadow: { offsetX: px(3), offsetY: px(4), blur: px(5), color: "#0008" },
    });

    const svg = renderSvg(project.build(), 0);
    expect(svg).toContain("<feGaussianBlur");
    expect(svg).toContain("<feFlood");
    expect(svg).toContain("<feMerge");
    expect(svg).toContain('font-family="Inter &amp; Friends"');
    expect(svg).toContain('font-weight="700" text-anchor="middle" letter-spacing="2"');
    expect(svg).toContain('fill="#336699" fill-opacity="0.8"');
  });
});
