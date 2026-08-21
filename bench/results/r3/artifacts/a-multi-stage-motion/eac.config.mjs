import { experience, px, sec } from "@eac/core";

const project = experience({
  name: "sequential-current-state-motion",
  width: px(800),
  height: px(450),
  duration: sec(6),
  fps: 30,
});

const scene = project.scene("main");

scene
  .circle("traveler", {
    position: { x: px(100), y: px(225) },
    radius: px(28),
    fill: "#7c3aed",
  })
  .moveTo(
    { x: px(300), y: px(125) },
    { at: sec(0), duration: sec(2) },
  )
  .moveTo(
    { x: px(500), y: px(325) },
    { at: sec(2), duration: sec(2) },
  )
  .moveTo(
    { x: px(700), y: px(225) },
    { at: sec(4), duration: sec(2) },
  );

export default project;
