import { describe, expect, it } from "vitest";
import { assertExpectedCommit } from "../src/freeze.js";

describe("freeze verification", () => {
  it("rejects a mismatched evaluator commit", () => {
    expect(() => assertExpectedCommit("actual", "expected")).toThrow("Benchmark commit mismatch");
  });
});
