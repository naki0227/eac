import { describe, expect, it } from "vitest";
import {
  deg,
  easing,
  experience,
  motion,
  opacity,
  px,
  schedule,
  sec,
  sequence,
  trajectory,
} from "@eac/core";
import type { ExperienceIR, NodeIR } from "@eac/ir";
import { checkExperience, formatCheckResult } from "./index.js";

function ids(project: ReturnType<typeof experience>): string[] {
  return checkExperience(project.build()).diagnostics.map((item) => item.id);
}

describe("checker", () => {
  it("detects writer conflicts and invalid time ranges", () => {
    const project = experience({ name: "bad", width: px(100), height: px(100), duration: sec(2) });
    const dot = project
      .scene("main")
      .circle("dot", { position: { x: px(10), y: px(10) }, radius: px(2), fill: "red" });
    dot.moveTo({ x: px(20), y: px(10) }, { at: sec(0), duration: sec(1.5) });
    dot.moveTo({ x: px(30), y: px(10) }, { at: sec(1), duration: sec(2) });
    expect(ids(project)).toEqual(
      expect.arrayContaining(["eac::motion::conflicting-writers", "eac::timeline::invalid-range"]),
    );
    const conflict = checkExperience(project.build()).diagnostics.find(
      (diagnostic) => diagnostic.id === "eac::motion::conflicting-writers",
    );
    expect(conflict?.details).toEqual(
      expect.arrayContaining([
        expect.stringContaining("position writer timeline"),
        expect.stringContaining("conflict"),
      ]),
    );
  });

  it("rejects unsupported properties and cycles", () => {
    const project = experience({ name: "bad", width: px(100), height: px(100), duration: sec(1) });
    const scene = project.scene("main");
    const a = scene.circle("a", { position: { x: px(10), y: px(10) }, radius: px(2), fill: "red" });
    const b = scene.circle("b", {
      position: { x: px(90), y: px(90) },
      radius: px(2),
      fill: "blue",
    });
    a.dependsOn(b).unsupported("reactive", "hover");
    b.dependsOn(a).unsupported("simulated", "physics");
    expect(ids(project)).toEqual(
      expect.arrayContaining([
        "eac::property::reactive-unsupported",
        "eac::property::simulated-unsupported",
        "eac::dependency::cycle",
      ]),
    );
  });

  it("detects AABB overlap and emits actionable diagnostics", () => {
    const project = experience({
      name: "overlap",
      width: px(100),
      height: px(100),
      duration: sec(1),
      fps: 10,
    });
    const scene = project.scene("main");
    scene.rect("a", {
      position: { x: px(50), y: px(50) },
      width: px(20),
      height: px(20),
      fill: "red",
    });
    scene
      .rect("b", {
        position: { x: px(55), y: px(50) },
        width: px(20),
        height: px(20),
        fill: "blue",
      })
      .fadeTo(opacity(0), { at: sec(0), duration: sec(1) });
    const result = checkExperience(project.build());
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "eac::layout::aabb-overlap", how: expect.any(Array) }),
      ]),
    );
    expect(formatCheckResult(result)).toContain("Why:");
  });

  it("detects runtime unit, numeric, opacity, and trajectory errors", () => {
    const project = experience({
      name: "runtime-input",
      width: px(100),
      height: px(100),
      duration: sec(1),
    });
    project
      .scene("main")
      .circle("dot", {
        position: { x: px(10), y: px(10) },
        radius: px(2),
        fill: "red",
      })
      .moveTo(
        { x: px(20), y: px(20) },
        {
          at: sec(0),
          duration: sec(1),
          trajectory: { kind: "cycloid", radius: px(1) },
        },
      );
    const valid = project.build();
    const object = valid.scenes[0]?.nodes[0];
    const malformed = {
      ...valid,
      scenes: [
        {
          ...valid.scenes[0],
          nodes: [
            {
              ...object,
              properties: {
                ...object?.properties,
                rotation: {
                  ...object?.properties.rotation,
                  initial: { kind: "length", value: 1 },
                },
                opacity: {
                  ...object?.properties.opacity,
                  segments: [
                    {
                      id: "bad-opacity",
                      start: sec(0),
                      duration: sec(1),
                      target: { kind: "opacity", value: 2 },
                    },
                  ],
                },
                depth: {
                  ...object?.properties.depth,
                  initial: { kind: "depth", value: Number.NaN },
                },
                position: {
                  ...object?.properties.position,
                  segments: [
                    {
                      ...object?.properties.position.segments[0],
                      trajectory: "easeInOut",
                    },
                  ],
                },
              },
            },
          ],
        },
      ],
    } as unknown as ExperienceIR;
    const diagnostics = checkExperience(malformed).diagnostics;
    expect(diagnostics.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "eac::numeric::invalid",
        "eac::numeric::invalid-opacity",
        "eac::geometry::invalid",
      ]),
    );
  });

  it("rejects invalid scale and cubic Bezier easing values", () => {
    const project = experience({
      name: "invalid-transform",
      width: px(100),
      height: px(100),
      duration: sec(1),
    });
    project
      .scene("main")
      .circle("dot", {
        position: { x: px(10), y: px(10) },
        radius: px(2),
        fill: "red",
      })
      .scaleTo(-1, { at: sec(0), duration: sec(1), easing: easing.easeOut });

    const valid = project.build();
    const segment = valid.scenes[0]?.nodes[0]?.properties.scale.segments[0];
    if (!segment) throw new Error("Expected scale segment in test fixture.");
    const malformed = {
      ...valid,
      scenes: [
        {
          ...valid.scenes[0],
          nodes: [
            {
              ...valid.scenes[0]?.nodes[0],
              properties: {
                ...valid.scenes[0]?.nodes[0]?.properties,
                scale: {
                  ...valid.scenes[0]?.nodes[0]?.properties.scale,
                  segments: [
                    { ...segment, easing: { kind: "cubic-bezier", x1: -1, y1: 0, x2: 1, y2: 1 } },
                  ],
                },
              },
            },
          ],
        },
      ],
    } as unknown as ExperienceIR;

    expect(checkExperience(malformed).diagnostics.map((item) => item.id)).toEqual(
      expect.arrayContaining(["eac::transform::invalid-scale", "eac::motion::invalid-easing"]),
    );
  });

  it("treats followPath as one position writer and keeps rotation independent", () => {
    const project = experience({ name: "path", width: px(200), height: px(200), duration: sec(2) });
    const dot = project
      .scene("main")
      .circle("dot", { position: { x: px(0), y: px(0) }, radius: px(4), fill: "red" });
    dot
      .followPath(trajectory.orbit({ center: { x: px(100), y: px(100) }, radius: px(20) }), {
        at: sec(0),
        duration: sec(2),
      })
      .moveTo({ x: px(10), y: px(10) }, { at: sec(1), duration: sec(0.5) })
      .rotateTo(deg(180), { at: sec(0), duration: sec(2) });

    expect(ids(project).filter((id) => id === "eac::motion::conflicting-writers")).toHaveLength(1);
  });

  it("rejects cyclic raw group hierarchies without recursing forever", () => {
    const project = experience({
      name: "cycle",
      width: px(100),
      height: px(100),
      duration: sec(1),
    });
    const group = project.scene("main").group("loop");
    (group.ir.children as NodeIR[]).push(group.ir);

    expect(ids(project)).toContain("eac::hierarchy::cycle");
  });

  it("checks plan-lowered writes with the ordinary timeline rules", () => {
    const project = experience({ name: "plan", width: px(100), height: px(100), duration: sec(1) });
    const dot = project
      .scene("main")
      .circle("dot", { position: { x: px(0), y: px(0) }, radius: px(4), fill: "red" });
    schedule(
      sequence(
        motion.moveTo(dot, { x: px(20), y: px(0) }, { duration: sec(0.75) }),
        motion.moveTo(dot, { x: px(40), y: px(0) }, { duration: sec(0.75) }),
      ),
      { at: sec(0) },
    );

    expect(ids(project)).toContain("eac::timeline::invalid-range");
  });
});

describe("degenerate timelines", () => {
  it("reports a zero-duration motion instead of throwing during sampling", () => {
    const project = experience({
      name: "zero",
      width: px(100),
      height: px(100),
      duration: sec(2),
    });
    project
      .scene("main")
      .circle("dot", { position: { x: px(10), y: px(10) }, radius: px(5), fill: "#ffffff" })
      .moveTo({ x: px(90), y: px(90) }, { at: sec(1), duration: sec(0) });

    const result = checkExperience(project.build());

    expect(result.diagnostics.map(({ id }) => id)).toContain("eac::timeline::invalid-range");
    expect(result.stats.frames).toBeGreaterThan(0);
    expect(result.stats.invalidTransforms).toBe(0);
  });
});
