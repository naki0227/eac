import { depth, experience, px, sec } from "@eac/core";

const project = experience({
  name: "behind-to-front",
  width: px(640),
  height: px(360),
  duration: sec(4),
});

const scene = project.scene("depth-transition");

const movingCircle = scene.circle("moving-circle", {
  position: { x: px(320), y: px(180) },
  radius: px(90),
  fill: "#f97316",
  depth: depth(-100),
});

scene.rect("stationary-panel", {
  position: { x: px(320), y: px(180) },
  width: px(150),
  height: px(150),
  cornerRadius: px(18),
  fill: "#2563eb",
  depth: depth(0),
});

movingCircle.bringForward({
  at: sec(1),
  duration: sec(2),
  to: depth(100),
});

export default project;
