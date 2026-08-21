import { describe, expect, it } from "vitest";
import { deg, lerpUnit, ms, opacity, px, rad, sec } from "./index.js";

describe("unit constructors", () => {
  it("normalizes time and angles", () => {
    expect(ms(250)).toEqual(sec(0.25));
    expect(rad(Math.PI)).toEqual(deg(180));
  });

  it("preserves branded units during interpolation", () => {
    expect(lerpUnit(px(10), px(30), 0.25)).toEqual(px(15));
  });

  it("rejects invalid opacity and non-finite values", () => {
    expect(() => opacity(1.1)).toThrow(RangeError);
    expect(() => sec(Number.NaN)).toThrow(RangeError);
  });
});
