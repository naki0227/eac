import { depth, experience, px, sec } from "@eac/core";

const project = experience({
  name: "cycloid-depth",
  width: px(640),
  height: px(360),
  duration: sec(5),
  fps: 30,
});

const scene = project.scene("main");
scene.rect("gate", {
  position: { x: px(320), y: px(190) },
  width: px(90),
  height: px(220),
  fill: "#27272a",
  depth: depth(0),
});

scene
  .circle("traveler", {
    position: { x: px(80), y: px(220) },
    radius: px(24),
    fill: "#22d3ee",
    depth: depth(-100),
  })
  .moveTo(
    { x: px(560), y: px(220) },
    {
      at: sec(0.5),
      duration: sec(4),
      trajectory: { kind: "cycloid", radius: px(45), turns: 2 },
    },
  )
  .bringForward({ at: sec(2), duration: sec(1), to: depth(100) });

export default project;
