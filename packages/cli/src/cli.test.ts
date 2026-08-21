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
});
