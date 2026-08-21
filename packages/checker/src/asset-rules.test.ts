import { describe, expect, it } from "vitest";
import { experience, px, sec } from "@eac/core";
import type { ExperienceIR } from "@eac/ir";
import { checkExperience } from "./index.js";

describe("asset checker", () => {
  it("requires local assets to pass through the resolver", () => {
    const project = experience({
      name: "asset",
      width: px(100),
      height: px(100),
      duration: sec(1),
    });
    project.scene("main").image("photo", {
      src: "photo.png",
      position: { x: px(50), y: px(50) },
      width: px(40),
      height: px(40),
    });
    expect(checkExperience(project.build()).diagnostics.map(({ id }) => id)).toContain(
      "eac::asset::unresolved",
    );
  });

  it("reports resolver failures with stable namespaced ids", () => {
    const project = experience({
      name: "asset",
      width: px(100),
      height: px(100),
      duration: sec(1),
    });
    project.scene("main").image("photo", {
      src: "photo.png",
      position: { x: px(50), y: px(50) },
      width: px(40),
      height: px(40),
    });
    const valid = project.build();
    const node = valid.scenes[0]?.nodes[0];
    if (node?.kind !== "object" || node.geometry.kind !== "image")
      throw new Error("Expected image in test fixture.");
    const malformed = {
      ...valid,
      scenes: [
        {
          ...valid.scenes[0],
          nodes: [
            {
              ...node,
              geometry: {
                ...node.geometry,
                asset: {
                  kind: "invalid",
                  path: "photo.png",
                  reason: "missing",
                  detail: "asset file does not exist",
                },
              },
            },
          ],
        },
      ],
    } as ExperienceIR;
    expect(checkExperience(malformed).diagnostics.map(({ id }) => id)).toContain(
      "eac::asset::missing",
    );
  });
});
