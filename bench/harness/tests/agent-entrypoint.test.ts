import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { harnessRoot } from "../src/config.js";

describe("Codex Docker entrypoint", () => {
  it("uses automatic review without an incompatible explicit sandbox flag", async () => {
    const source = await readFile(resolve(harnessRoot, "docker/run-agent.mjs"), "utf8");
    expect(source).toContain('"--approve-for-me"');
    expect(source).not.toContain('"--sandbox"');
  });
});
