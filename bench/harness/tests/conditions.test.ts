import { describe, expect, it } from "vitest";
import { commandIsAllowed } from "../src/conditions.js";

describe("condition command policy", () => {
  it("exposes no EaC CLI in Condition A", () => {
    expect(commandIsAllowed("A", "help")).toBe(false);
    expect(commandIsAllowed("A", "check")).toBe(false);
  });

  it("exposes docs but not check in Condition B", () => {
    for (const command of ["help", "guide", "docs"])
      expect(commandIsAllowed("B", command)).toBe(true);
    expect(commandIsAllowed("B", "check")).toBe(false);
  });

  it("adds check only in Condition C", () => {
    for (const command of ["help", "guide", "docs", "check"])
      expect(commandIsAllowed("C", command)).toBe(true);
  });
});
