import { experience, px, sec } from "@eac/core";

const project = experience({
  name: "inherited-sequential-motion",
  width: px(1280),
  height: px(720),
  duration: sec(5),
});

const scene = project.scene("main");

scene
  .circle("traveler", {
    position: { x: px(160), y: px(360) },
    radius: px(32),
    fill: "#7c3aed",
  })
  .moveTo({ x: px(480), y: px(180) }, { at: sec(0.5), duration: sec(1.25) })
  .moveTo({ x: px(800), y: px(540) }, { at: sec(1.75), duration: sec(1.25) })
  .moveTo({ x: px(1120), y: px(360) }, { at: sec(3), duration: sec(1.25) });

export default project;
