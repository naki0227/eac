import { describe, expect, it } from "vitest";
import {
  assertAuthPreflightMarker,
  assertExpectedCommit,
  assertPassedMarker,
} from "../src/freeze.js";
import { sha256 } from "../src/result.js";

describe("freeze verification", () => {
  it("rejects a mismatched evaluator commit", () => {
    expect(() => assertExpectedCommit("actual", "expected")).toThrow("Benchmark commit mismatch");
  });

  it("requires a passed marker for the frozen commit", () => {
    expect(() =>
      assertPassedMarker(
        { passed: true, implementationCommit: "old" },
        "current",
        "Auth transport preflight",
      ),
    ).toThrow("Auth transport preflight has not passed");
    expect(() =>
      assertPassedMarker(
        { passed: true, implementationCommit: "current" },
        "current",
        "Auth transport preflight",
      ),
    ).not.toThrow();
  });

  it("requires exact ChatGPT transport evidence", () => {
    const marker = {
      passed: true,
      implementationCommit: "current",
      authentication: "chatgpt",
      responseSha256: sha256("BENCH_AUTH_OK"),
      exposedMaterials: ["task.txt"],
    };
    expect(() => assertAuthPreflightMarker(marker, "current")).not.toThrow();
    expect(() =>
      assertAuthPreflightMarker({ ...marker, authentication: "api-key" }, "current"),
    ).toThrow("evidence is invalid");
  });
});
