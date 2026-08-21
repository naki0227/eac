import { experience, hex, hover, onClick, opacity, px, sec, toggle, when } from "@eac/core";

const project = experience({
  name: "click-toggle",
  width: px(640),
  height: px(360),
  duration: sec(5),
  fps: 30,
});

const scene = project.scene("main");
const expanded = scene.state("expanded", false);

const button = scene.rect("button", {
  position: { x: px(320), y: px(90) },
  width: px(180),
  height: px(56),
  cornerRadius: px(10),
  fill: hex("#38bdf8"),
});

const panel = scene.rect("panel", {
  position: { x: px(320), y: px(230) },
  width: px(320),
  height: px(140),
  cornerRadius: px(12),
  fill: hex("#f472b6"),
  opacity: opacity(0),
});

scene.bind(button, { scale: when(hover(button), 1.05, 1) });
scene.bind(panel, { opacity: when(expanded.value, 1, 0) });
scene.on(onClick(button), toggle(expanded));

export default project;
