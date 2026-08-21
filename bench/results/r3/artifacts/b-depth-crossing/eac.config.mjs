import { depth, experience, px, sec } from "@eac/core";

const project = experience({
  name: "behind-to-front",
  width: px(640),
  height: px(480),
  duration: sec(4),
});

const scene = project.scene("depth-transition");

scene.rect("stationary-object", {
  position: { x: px(320), y: px(240) },
  width: px(220),
  height: px(220),
  cornerRadius: px(24),
  fill: "#2563eb",
  depth: depth(0),
});

scene
  .circle("moving-object", {
    position: { x: px(320), y: px(240) },
    radius: px(72),
    fill: "#f97316",
    depth: depth(-100),
  })
  .bringForward({ at: sec(1), duration: sec(2), to: depth(100) });

export default project;
