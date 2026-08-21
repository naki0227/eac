import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runCli, searchDocs } from "./index.js";

afterEach(() => vi.restoreAllMocks());

describe("agent-facing CLI", () => {
  it("guides a first-time agent without exposing future APIs", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    expect(await runCli(["help"])).toBe(0);
    expect(log.mock.calls.flat().join("\n")).toContain("Do not attempt to invent EaC APIs");
  });

  it("searches docs deterministically", () => {
    expect(
      searchDocs("move along a cycloid")
        .map((doc) => doc.name)
        .slice(0, 2),
    ).toEqual(["cycloid", "moveTo"]);
    expect(searchDocs("move along a cycloid")).toEqual(searchDocs("move along a cycloid"));
  });

  it("returns an actionable error for an unknown API", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await runCli(["docs", "flyForward"])).toBe(1);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("docs search"));
  });

  it("lists available APIs when docs has no topic", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    expect(await runCli(["docs"])).toBe(0);
    expect(log.mock.calls.flat().join("\n")).toContain("moveTo");
  });

  it("formats a project without requiring an external formatter", async () => {
    const directory = await mkdtemp(join(tmpdir(), "eac-cli-format-"));
    const project = join(directory, "eac.config.mjs");
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      await writeFile(project, 'export default {name:"demo"}\n');
      expect(await runCli(["format", project])).toBe(0);
      expect(await readFile(project, "utf8")).toBe('export default { name: "demo" };\n');
      expect(log).toHaveBeenCalledWith(expect.stringContaining("Formatted"));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
