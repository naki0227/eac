import {
  clamp,
  experience,
  hex,
  key,
  onKeyDown,
  px,
  sec,
  setState,
  sub,
  add,
  when,
} from "@eac/core";

const project = experience({
  name: "keyboard-control",
  width: px(640),
  height: px(360),
  duration: sec(6),
  fps: 30,
});

const scene = project.scene("main");
const offset = scene.state("offset", 0);

const dot = scene.circle("dot", {
  position: { x: px(320), y: px(180) },
  radius: px(28),
  fill: hex("#a78bfa"),
});

// Keyboard is a global signal set; v0.3 has no focus model.
scene.bind(dot, {
  position: { x: add(320, offset.value), y: 180 },
  scale: when(key("Space"), 1.3, 1),
});
scene.on(onKeyDown("ArrowRight"), setState(offset, clamp(add(offset.value, 40), -240, 240)));
scene.on(onKeyDown("ArrowLeft"), setState(offset, clamp(sub(offset.value, 40), -240, 240)));

export default project;
