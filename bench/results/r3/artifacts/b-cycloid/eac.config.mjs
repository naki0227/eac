import { experience, px, sec } from "@eac/core";

const project = experience({
  name: "cycloid-motion",
  width: px(640),
  height: px(360),
  duration: sec(2),
  fps: 30,
});

const scene = project.scene("main");

scene
  .circle("moving-dot", {
    position: { x: px(100), y: px(180) },
    radius: px(20),
    fill: "#2563eb",
  })
  .moveTo(
    { x: px(540), y: px(180) },
    {
      at: sec(0),
      duration: sec(2),
      trajectory: { kind: "cycloid", radius: px(40), turns: 2 },
    },
  );

export default project;
