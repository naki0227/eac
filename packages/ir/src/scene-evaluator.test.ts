import { describe, expect, it } from "vitest";
import { multiplyMatrices, transformPoint, type Matrix2D } from "./index.js";

describe("2D affine matrices", () => {
  it("composes parent and local transforms in parent × local order", () => {
    const parent: Matrix2D = [0, 2, -2, 0, 100, 100];
    const child: Matrix2D = [1, 0, 0, 1, 15, 0];
    const world = multiplyMatrices(parent, child);

    expect(transformPoint(world, 0, 0)[0]).toBeCloseTo(100, 10);
    expect(transformPoint(world, 0, 0)[1]).toBeCloseTo(130, 10);
  });
});
