import { describe, expect, it } from "vitest";
import {
  parseCliEvents,
  parseEvaluation,
  sha256,
  sourceLines,
  validateResult,
} from "../src/result.js";

describe("result helpers", () => {
  it("parses authoritative checker totals", () => {
    expect(parseEvaluation(1, "Harness\n\n2 errors, 1 warnings\n", "")).toMatchObject({
      errors: 2,
      warnings: 1,
    });
  });

  it("counts format diagnostics outside the checker summary", () => {
    const stdout = [
      "error[eac::format::required]",
      "",
      "warning[eac::layout::aabb-overlap]",
      "",
      "0 errors, 1 warnings",
      "",
    ].join("\n");
    expect(parseEvaluation(1, stdout, "")).toMatchObject({ errors: 1, warnings: 1 });
  });

  it("parses only structured CLI telemetry", () => {
    const logs = [
      "noise",
      'EAC_CLI_EVENT {"timestamp":"2026-08-21T00:00:00.000Z","command":"docs","argsCategory":"docs-search","exitCode":0}',
    ].join("\n");
    expect(parseCliEvents(logs)).toHaveLength(1);
  });

  it("computes stable source metadata", () => {
    expect(sha256("a")).toBe("ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb");
    expect(sourceLines("a\nb\n")).toBe(2);
  });

  it("rejects incomplete external records", () => {
    expect(() => validateResult({ run_id: "incomplete", condition: "A" })).toThrow(
      "task_id must be a string",
    );
  });
});
