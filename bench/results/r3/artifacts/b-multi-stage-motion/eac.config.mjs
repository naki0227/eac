import { experience, px, sec } from "@eac/core";

const project = experience({
  name: "sequential-inherited-motion",
  width: px(800),
  height: px(450),
  duration: sec(6),
});

const scene = project.scene("main");

scene
  .circle("traveler", {
    position: { x: px(100), y: px(225) },
    radius: px(30),
    fill: "#7c3aed",
  })
  .moveTo(
    { x: px(300), y: px(100) },
    { at: sec(0.5), duration: sec(1.5) },
  )
  .moveTo(
    { x: px(500), y: px(350) },
    { at: sec(2), duration: sec(1.5) },
  )
  .moveTo(
    { x: px(700), y: px(225) },
    { at: sec(3.5), duration: sec(1.5) },
  );

export default project;
