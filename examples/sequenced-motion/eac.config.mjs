import {
  deg,
  easing,
  experience,
  motion,
  opacity,
  parallel,
  px,
  schedule,
  sec,
  sequence,
  stagger,
} from "@eac/core";

const project = experience({
  name: "sequenced-motion",
  width: px(640),
  height: px(360),
  duration: sec(5),
  fps: 30,
});

const scene = project.scene("main");
const row = scene.group("row", { position: { x: px(320), y: px(180) } });
const dots = [-120, 0, 120].map((x, index) =>
  row.circle(`dot-${index}`, {
    position: { x: px(x), y: px(0) },
    radius: px(24),
    fill: ["#38bdf8", "#a78bfa", "#f472b6"][index],
    opacity: opacity(0.15),
  }),
);

schedule(
  sequence(
    stagger(dots, sec(0.15), (dot) =>
      motion.fadeTo(dot, opacity(1), {
        duration: sec(0.35),
        easing: easing.easeOut,
      }),
    ),
    parallel(
      motion.rotateTo(row, deg(360), {
        duration: sec(2),
        easing: easing.easeInOut,
      }),
      motion.scaleTo(row, 1.3, { duration: sec(1), easing: easing.easeOut }),
    ),
    motion.scaleTo(row, 1, { duration: sec(0.5), easing: easing.easeInOut }),
  ),
  { at: sec(0.5) },
);

export default project;
