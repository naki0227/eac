import { describe, expect, it } from "vitest";
import {
  assertAuthPreflightMarker,
  assertExpectedCommit,
  assertMaterialDiscoveryMarker,
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

  it("binds material discovery evidence to commit and model configuration", () => {
    const marker = {
      passed: true,
      implementationCommit: "current",
      authentication: "chatgpt",
      model: "gpt-test",
      reasoningConfig: "medium",
      apiName: "experience",
      declarationPath: "/materials/public-api/@eac/core/index.d.ts",
      readmeRead: true,
      declarationRead: true,
      responseSha256: "a".repeat(64),
      workspaceFiles: [],
    };
    expect(() =>
      assertMaterialDiscoveryMarker(marker, "current", "gpt-test", "medium"),
    ).not.toThrow();
    expect(() => assertMaterialDiscoveryMarker(marker, "current", "gpt-test", "high")).toThrow(
      "evidence is invalid",
    );
  });
});
