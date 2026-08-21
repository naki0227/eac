import { describe, expect, it } from "vitest";
import { evaluateScene } from "@eac/ir";
import { easing, experience, hex, px, sec } from "./index.js";

describe("deterministic object styling", () => {
  it("normalizes static style and time-orders color and blur motions", () => {
    const project = experience({
      name: "style",
      width: px(200),
      height: px(100),
      duration: sec(3),
    });
    const card = project.scene("main").rect("card", {
      position: { x: px(100), y: px(50) },
      width: px(80),
      height: px(40),
      cornerRadius: px(8),
      fill: "#ff0000",
      stroke: "white",
      strokeWidth: px(3),
      blur: px(0),
      shadow: { offsetX: px(4), offsetY: px(6), blur: px(8), color: "#0008" },
    });
    card
      .colorTo("#0000ff", { at: sec(2), duration: sec(0.5) })
      .colorTo("#00ff00", { at: sec(1), duration: sec(0.5), easing: easing.easeOut })
      .blurTo(px(4), { at: sec(1), duration: sec(1) });

    expect(card.ir.appearance.fill.segments.map(({ target }) => target)).toEqual([
      hex("#00ff00"),
      hex("#0000ff"),
    ]);
    const scene = project.build().scenes[0];
    if (!scene) throw new Error("Expected scene in test fixture.");
    const evaluated = evaluateScene(scene, 1.5)[0];
    if (!evaluated) throw new Error("Expected evaluated object in test fixture.");
    expect(evaluated.appearance.blur).toBe(2);
    expect(evaluated.appearance.strokeWidth).toBe(3);
    expect(evaluated.appearance.shadow?.color).toEqual(hex("#0008"));
  });
});
