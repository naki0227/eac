import { depth, experience, px, sec } from "@eac/core";

const project = experience({
  name: "bring-object-to-front",
  width: px(640),
  height: px(360),
  duration: sec(3),
});

const scene = project.scene("depth-transition");

scene.rect("stationary-object", {
  position: { x: px(320), y: px(180) },
  width: px(180),
  height: px(180),
  cornerRadius: px(24),
  fill: "#2563eb",
  depth: depth(0),
});

scene
  .circle("moving-object", {
    position: { x: px(320), y: px(180) },
    radius: px(70),
    fill: "#f97316",
    depth: depth(-1),
  })
  .bringForward({
    at: sec(1),
    duration: sec(1),
    to: depth(1),
  });

export default project;
