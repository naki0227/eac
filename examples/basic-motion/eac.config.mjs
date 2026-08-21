import { deg, experience, opacity, px, sec } from "@eac/core";

const project = experience({
  name: "basic-motion",
  width: px(640),
  height: px(360),
  duration: sec(5),
  fps: 30,
});

const scene = project.scene("main");
scene
  .rect("card", {
    position: { x: px(320), y: px(180) },
    width: px(240),
    height: px(120),
    cornerRadius: px(18),
    fill: "#18181b",
  })
  .rotateTo(deg(8), { at: sec(1), duration: sec(1) })
  .rotateTo(deg(0), { at: sec(2), duration: sec(1) });

scene
  .circle("dot", {
    position: { x: px(80), y: px(70) },
    radius: px(20),
    fill: "#8b5cf6",
  })
  .moveTo({ x: px(560), y: px(70) }, { at: sec(0.5), duration: sec(3) })
  .fadeTo(opacity(0.2), { at: sec(3.5), duration: sec(1) });

export default project;
