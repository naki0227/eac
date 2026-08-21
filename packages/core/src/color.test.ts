import { describe, expect, it } from "vitest";
import { hex, normalizeColor, rgb, rgba } from "./index.js";

describe("typed colors", () => {
  it("normalizes rgb, rgba, short hex, and alpha hex into sRGB channels", () => {
    expect(rgb(255, 128, 0)).toEqual({
      kind: "color",
      red: 1,
      green: 128 / 255,
      blue: 0,
      alpha: 1,
    });
    expect(rgba(0, 0, 255, 0.5).alpha).toBe(0.5);
    expect(hex("#0f08")).toEqual(rgba(0, 255, 0, 136 / 255));
    expect(hex("#112233")).toEqual(rgba(17, 34, 51, 1));
    expect(normalizeColor("none").alpha).toBe(0);
  });

  it("rejects unsupported strings and out-of-range channels early", () => {
    expect(() => rgb(256, 0, 0)).toThrow("between 0 and 255");
    expect(() => rgba(0, 0, 0, -0.1)).toThrow("between 0 and 1");
    expect(() => hex("#12")).toThrow("hex color");
    expect(() => normalizeColor("color(display-p3 1 0 0)")).toThrow("Unsupported named color");
  });
});
