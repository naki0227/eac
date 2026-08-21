import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadProject, runCli, searchDocs } from "./index.js";

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
    expect(searchDocs("follow a spiral path")[0]?.name).toBe("spiral");
    expect(searchDocs("nested parent transform")[0]?.name).toBe("group");
    expect(searchDocs("stagger several items")[0]?.name).toBe("stagger");
    expect(searchDocs("animate sRGB fill")[0]?.name).toBe("color");
    expect(searchDocs("cover a local PNG")[0]?.name).toBe("image");
    expect(searchDocs("audio trim fade sound clip")[0]?.name).toBe("audio");
  });

  it("returns an actionable error for an unknown API", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await runCli(["docs", "flyForward"])).toBe(1);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("docs search"));
  });

  it("supports trajectory subtopics", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    expect(await runCli(["docs", "trajectory", "spiral"])).toBe(0);
    expect(log.mock.calls.flat().join("\n")).toContain("trajectory.spiral");
  });

  it("lists available APIs when docs has no topic", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    expect(await runCli(["docs"])).toBe(0);
    const output = log.mock.calls.flat().join("\n");
    expect(output).toContain("Motion:\n  moveTo");
    expect(output).toContain("Assets:");
    expect(output).toContain("Audio:");
    expect(output).toContain("Validation:");
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

  it("refuses serialized v0.1 IR instead of reading it as v0.2", async () => {
    const directory = await mkdtemp(join(tmpdir(), "eac-cli-legacy-"));
    try {
      const legacy = join(directory, "eac.json");
      await writeFile(legacy, JSON.stringify({ version: "0.1", scenes: [] }));
      await expect(loadProject(legacy)).rejects.toThrow("serialized EaC v0.1 IR");

      const unknown = join(directory, "unknown.json");
      await writeFile(unknown, JSON.stringify({ scenes: [] }));
      await expect(loadProject(unknown)).rejects.toThrow("does not contain EaC v0.2 IR");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("drives check, inspect, and preview from a scenario", async () => {
    const directory = await mkdtemp(join(tmpdir(), "eac-cli-scenario-"));
    const project = join(import.meta.dirname, "../../../examples/scenario-replay/eac.config.mjs");
    const trace = join(
      import.meta.dirname,
      "../../../examples/scenario-replay/replay.eac-scenario.mjs",
    );
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      expect(await runCli(["check", "--ci", project, "--scenario", trace])).toBe(0);
      const checkOutput = log.mock.calls.flat().join("\n");
      expect(checkOutput).toContain("assertions passed");
      expect(checkOutput).toContain("state transitions");

      log.mockClear();
      expect(await runCli(["inspect", project, "--scenario", trace])).toBe(0);
      const inspectOutput = log.mock.calls.flat().join("\n");
      expect(inspectOutput).toContain("Bindings:");
      expect(inspectOutput).toContain("trigger.scale");
      expect(inspectOutput).toContain("click(trigger)");
      expect(inspectOutput).toContain("armed false → true");

      log.mockClear();
      expect(await runCli(["inspect", project, "--scenario", trace, "--json"])).toBe(0);
      const snapshot: unknown = JSON.parse(log.mock.calls.flat().join(""));
      expect(snapshot).toMatchObject({
        signals: expect.arrayContaining(["hover(trigger)", "state(armed)"]),
        scenarioReplay: { name: "replay" },
      });

      const preview = join(directory, "preview.html");
      expect(await runCli(["preview", project, "--scenario", trace, "--output", preview])).toBe(0);
      const html = await readFile(preview, "utf8");
      expect(html).toContain("Replaying scenario replay");
      expect(html).toContain('id="record"');
      expect(html).toContain("Export scenario");
      expect(html).not.toContain("<script id=");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("honors the project prettier configuration in format and check", async () => {
    const directory = await mkdtemp(join(tmpdir(), "eac-cli-config-"));
    const project = join(directory, "eac.config.mjs");
    const wide =
      'import { experience, px, sec } from "@eac/core";\n' +
      'const project = experience({ name: "wide", width: px(10), height: px(10), duration: sec(1) });\n' +
      "export default project;\n";
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      await writeFile(join(directory, ".prettierrc.json"), '{ "printWidth": 100 }\n');
      await writeFile(project, wide);
      expect(await runCli(["format", project])).toBe(0);
      expect(await readFile(project, "utf8")).toBe(wide);
      expect(
        await runCli([
          "check",
          "--ci",
          join(import.meta.dirname, "../../../examples/audio-sting/eac.config.mjs"),
        ]),
      ).toBe(0);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
