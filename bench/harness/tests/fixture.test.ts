import { describe, expect, it } from "vitest";
import { checkExperience } from "@eac/checker";
import type { ExperienceBuilder } from "@eac/core";

const fixtureModule: unknown = await import(
  new URL("../fixtures/broken-experience/eac.config.mjs", import.meta.url).href
);
const fixture = (fixtureModule as { default: ExperienceBuilder }).default;

describe("broken experience fixture", () => {
  it("freezes the three intended diagnostic categories", () => {
    const diagnostics = checkExperience(fixture.build()).diagnostics;
    expect(diagnostics.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        "eac::motion::conflicting-writers",
        "eac::timeline::invalid-range",
        "eac::layout::aabb-overlap",
      ]),
    );
  });
});
