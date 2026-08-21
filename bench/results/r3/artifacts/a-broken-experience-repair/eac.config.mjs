import { deg, depth, experience, px, sec } from "@eac/core";

const project = experience({
  name: "broken-experience",
  width: px(320),
  height: px(180),
  duration: sec(3),
  fps: 10,
});
const scene = project.scene("main");
const foreground = scene.rect("foreground", {
  position: { x: px(120), y: px(90) },
  width: px(80),
  height: px(80),
  fill: "#7c3aed",
  depth: depth(1),
});
scene.rect("background", {
  position: { x: px(130), y: px(90) },
  width: px(100),
  height: px(100),
  fill: "#0f172a",
});

foreground.moveTo({ x: px(180), y: px(90) }, { at: sec(0), duration: sec(2) });
foreground.moveTo({ x: px(220), y: px(90) }, { at: sec(2), duration: sec(1) });
foreground.rotateTo(deg(180), { at: sec(2.5), duration: sec(0.5) });

export default project;
