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

  it("installs the OS CA bundle required by the Codex binary", async () => {
    const dockerfile = await readFile(resolve(harnessRoot, "docker/Dockerfile.agent"), "utf8");
    expect(dockerfile).toContain("apt-get install --yes --no-install-recommends ca-certificates");
  });
});
