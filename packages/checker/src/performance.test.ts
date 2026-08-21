import { evaluateScene } from "@eac/ir";
import { checkExperience } from "./index.js";
import { describe, expect, it } from "vitest";
import { experience, deg, opacity, px, sec } from "@eac/core";

const GROUPS = 5;
const NODES_PER_GROUP = 6;
const DURATION = 10;
const FPS = 30;

function stressProject() {
  const project = experience({
    name: "performance-sanity",
    width: px(1280),
    height: px(720),
    duration: sec(DURATION),
    fps: FPS,
  });
  const scene = project.scene("main");
  for (let g = 0; g < GROUPS; g += 1) {
    const group = scene.group(`group-${String(g)}`, {
      position: { x: px(100 + g * 200), y: px(120) },
    });
    group.rotateTo(deg(360), { at: sec(0), duration: sec(DURATION) });
    for (let n = 0; n < NODES_PER_GROUP; n += 1) {
      const node = group.circle(`dot-${String(g)}-${String(n)}`, {
        position: { x: px(n * 12), y: px(n * 40) },
        radius: px(8),
        fill: "#38bdf8",
      });
      node.moveTo({ x: px(n * 12 + 60), y: px(n * 40) }, { at: sec(n * 0.5), duration: sec(1) });
      node.fadeTo(opacity(0.25), { at: sec(2 + n * 0.5), duration: sec(1) });
    }
  }
  return project.build();
}

/**
 * Regression sanity check, not a published benchmark. It measures `evaluateScene` alone — IR
 * property evaluation and world-transform composition — with no rasterization, SVG lowering, or
 * encoding. The budget is deliberately loose so it catches an accidental per-frame sort or history
 * replay rather than tracking machine speed.
 */
describe("performance sanity", () => {
  it("evaluates a 30-node, five-group, ten-second scene within a bounded budget", () => {
    const ir = stressProject();
    const scene = ir.scenes[0];
    if (!scene) throw new Error("Expected a scene.");

    expect(checkExperience(ir).errors).toBe(0);
    expect(evaluateScene(scene, 0)).toHaveLength(GROUPS * NODES_PER_GROUP);

    const frames = DURATION * FPS;
    const started = performance.now();
    for (let frame = 0; frame <= frames; frame += 1) evaluateScene(scene, frame / FPS);
    const elapsed = performance.now() - started;

    expect(elapsed).toBeLessThan(2_000);
  });
});
