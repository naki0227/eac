import { describe, expect, it } from "vitest";
import { findUndefinedApiCandidates } from "../src/api-observer.js";

describe("undefined API observation", () => {
  it("keeps auditable candidates without treating syntax errors as APIs", () => {
    const evidence = "star.flyForward(); dot.moveTo(target, options); const = ;";
    expect(findUndefinedApiCandidates(evidence, new Set(["moveTo"]))).toEqual([
      { name: "flyForward", excerpt: "star.flyForward(" },
    ]);
  });
});
