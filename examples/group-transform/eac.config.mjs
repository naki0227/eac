import { deg, easing, experience, opacity, px, sec } from "@eac/core";

const project = experience({
  name: "group-transform",
  width: px(640),
  height: px(360),
  duration: sec(4),
  fps: 30,
});

const scene = project.scene("main");
const constellation = scene.group("constellation", {
  position: { x: px(320), y: px(180) },
  opacity: opacity(0.9),
});
const pair = constellation.group("pair", {
  scale: { x: 1.2, y: 0.8 },
});

pair.circle("left", {
  position: { x: px(-90), y: px(0) },
  radius: px(24),
  fill: "#38bdf8",
});
pair.circle("right", {
  position: { x: px(90), y: px(0) },
  radius: px(24),
  fill: "#f472b6",
});

constellation
  .rotateTo(deg(360), {
    at: sec(0),
    duration: sec(4),
    easing: easing.easeInOut,
  })
  .scaleTo(1.25, { at: sec(1), duration: sec(2), easing: easing.easeOut });

export default project;
