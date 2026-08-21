import { describe, expect, it } from "vitest";
import { experience, opacity, px, sec } from "@eac/core";
import type { ExperienceIR } from "@eac/ir";
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
    const object = valid.scenes[0]?.objects[0];
    const malformed = {
      ...valid,
      scenes: [
        {
          ...valid.scenes[0],
          objects: [
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
});
