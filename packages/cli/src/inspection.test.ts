import { checkExperience } from "@eac/checker";
import { asset, experience, opacity, px, sec } from "@eac/core";
import { describe, expect, it } from "vitest";
import { formatInspection, inspectExperience } from "./inspection.js";

describe("experience inspection", () => {
  it("reports a deterministic node tree, normalized writers, and assets", () => {
    const project = experience({
      name: "inspect",
      width: px(320),
      height: px(180),
      duration: sec(2),
      fps: 24,
    });
    const hero = project.scene("main").group("hero");
    hero
      .image("logo", {
        src: asset("assets/logo.svg"),
        position: { x: px(20), y: px(20) },
        width: px(40),
        height: px(40),
      })
      .fadeTo(opacity(0.5), { at: sec(0.5), duration: sec(0.25) });

    const ir = project.build();
    const inspection = inspectExperience(ir, checkExperience(ir));

    expect(inspection.counts).toMatchObject({
      nodes: 2,
      groups: 1,
      objects: 1,
      images: 1,
      writers: 1,
      maxDepth: 2,
    });
    expect(inspection.scenes[0]?.nodes[0]?.children[0]?.writers[0]).toMatchObject({
      property: "main.hero.logo.opacity",
      start: 0.5,
      end: 0.75,
    });
    expect(inspection.assets).toEqual([
      { node: "main.hero.logo", path: "assets/logo.svg", status: "local" },
    ]);
    expect(formatInspection(inspection)).toContain("└─ Image logo [z=0]");
  });
});
