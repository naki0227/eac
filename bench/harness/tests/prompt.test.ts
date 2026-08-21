import { describe, expect, it } from "vitest";
import { buildBenchmarkAgentPrompt, buildMaterialDiscoveryPrompt } from "../src/prompt.js";

describe("benchmark agent prompt", () => {
  it("points Condition A at allowed materials without suggesting an eac command", () => {
    const prompt = buildBenchmarkAgentPrompt("Frozen task wording.", "A");
    expect(prompt).toContain("Task:\nFrozen task wording.");
    expect(prompt).toContain("/materials/README.md");
    expect(prompt).toContain("/materials/public-api/");
    expect(prompt).toContain("/workspace/eac.config.mjs");
    expect(prompt).not.toContain("An `eac` command may be available");
  });

  it.each(["B", "C"] as const)(
    "gives Condition %s only a capability-presence hint",
    (condition) => {
      const prompt = buildBenchmarkAgentPrompt("Frozen task wording.", condition);
      expect(prompt).toContain("An `eac` command may be available in this condition.");
      expect(prompt).toContain("Use only commands that actually exist.");
      expect(prompt).not.toContain("eac check");
    },
  );

  it("reuses the same material paths for the real-agent discovery probe", () => {
    const prompt = buildMaterialDiscoveryPrompt();
    expect(prompt).toContain("Read /materials/README.md");
    expect(prompt).toContain(".d.ts file under\n/materials/public-api/");
    expect(prompt).toContain("Do not create or modify any files.");
  });
});
