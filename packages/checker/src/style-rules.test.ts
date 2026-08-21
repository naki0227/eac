import { describe, expect, it } from "vitest";
import { experience, px, sec } from "@eac/core";
import type { ExperienceIR } from "@eac/ir";
import { checkExperience } from "./index.js";

const ids = (experienceIr: ExperienceIR): string[] =>
  checkExperience(experienceIr).diagnostics.map((diagnostic) => diagnostic.id);

describe("style checker integration", () => {
  it("checks color writers through the ordinary conflict rule", () => {
    const project = experience({
      name: "conflict",
      width: px(100),
      height: px(100),
      duration: sec(2),
    });
    const card = project.scene("main").rect("card", {
      position: { x: px(50), y: px(50) },
      width: px(20),
      height: px(20),
      fill: "red",
    });
    card
      .colorTo("blue", { at: sec(0), duration: sec(1.5) })
      .colorTo("white", { at: sec(1), duration: sec(0.5) });

    expect(ids(project.build())).toContain("eac::motion::conflicting-writers");
  });

  it("rejects malformed raw color and static style values", () => {
    const project = experience({
      name: "invalid",
      width: px(100),
      height: px(100),
      duration: sec(1),
    });
    project.scene("main").text("title", "Text", {
      position: { x: px(10), y: px(20) },
      fontSize: px(12),
      fill: "white",
    });
    const valid = project.build();
    const node = valid.scenes[0]?.nodes[0];
    if (node?.kind !== "object") throw new Error("Expected object in test fixture.");
    const malformed = {
      ...valid,
      scenes: [
        {
          ...valid.scenes[0],
          nodes: [
            {
              ...node,
              appearance: {
                ...node.appearance,
                fill: {
                  ...node.appearance.fill,
                  initial: { kind: "color", red: 2, green: 0, blue: 0, alpha: 1 },
                },
                strokeWidth: px(-1),
              },
              geometry: { ...node.geometry, fontWeight: 0 },
            },
          ],
        },
      ],
    } as unknown as ExperienceIR;

    expect(ids(malformed)).toEqual(
      expect.arrayContaining(["eac::color::invalid", "eac::style::invalid"]),
    );
  });
});
