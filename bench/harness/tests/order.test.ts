import { describe, expect, it } from "vitest";
import { benchmark } from "../src/config.js";
import { assertCompletedPrefix, createRunOrder } from "../src/order.js";

const tasks = ["one", "two", "three", "four", "five"].map((id) => ({ id, prompt: id }));

describe("run order", () => {
  it("creates all 15 pairs once in a deterministic order", () => {
    const first = createRunOrder(tasks, benchmark.seed);
    const second = createRunOrder(tasks, benchmark.seed);
    expect(first).toEqual(second);
    expect(first).toHaveLength(15);
    expect(new Set(first.map(({ condition, taskId }) => `${condition}/${taskId}`)).size).toBe(15);
  });

  it("rejects resume results that skip ahead in the frozen order", () => {
    const order = createRunOrder(tasks, benchmark.seed);
    const first = order[0];
    const third = order[2];
    expect(first).toBeDefined();
    expect(third).toBeDefined();
    expect(() =>
      assertCompletedPrefix(
        order,
        new Set([`${first?.condition}/${first?.taskId}`, `${third?.condition}/${third?.taskId}`]),
      ),
    ).toThrow("not a prefix");
  });
});
