import { experience, hex, hover, onClick, opacity, px, sec, toggle, when } from "@eac/core";

const project = experience({
  name: "scenario-replay",
  width: px(640),
  height: px(360),
  duration: sec(6),
  fps: 30,
});

const scene = project.scene("main");
const armed = scene.state("armed", false);

const trigger = scene.rect("trigger", {
  position: { x: px(180), y: px(180) },
  width: px(160),
  height: px(100),
  cornerRadius: px(12),
  fill: hex("#38bdf8"),
});

const lamp = scene.circle("lamp", {
  position: { x: px(460), y: px(180) },
  radius: px(46),
  fill: hex("#f8fafc"),
  opacity: opacity(0.15),
});

scene.bind(trigger, { scale: when(hover(trigger), 1.06, 1) });
scene.bind(lamp, {
  opacity: when(armed.value, 1, 0.15),
  fill: { from: hex("#f8fafc"), to: hex("#facc15"), progress: when(armed.value, 1, 0) },
});
scene.on(onClick(trigger), toggle(armed));

export default project;
