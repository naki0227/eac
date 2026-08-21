import { deg, easing, experience, px, sec, trajectory } from "@eac/core";

const project = experience({
  name: "path-follow",
  width: px(640),
  height: px(360),
  duration: sec(5),
  fps: 30,
});

const scene = project.scene("main");
scene.path(
  "baseline",
  [
    { x: px(0), y: px(0) },
    { x: px(440), y: px(0) },
  ],
  {
    position: { x: px(100), y: px(180) },
    fill: "none",
    stroke: "#334155",
    strokeWidth: px(2),
  },
);

scene
  .circle("traveler", {
    position: { x: px(100), y: px(180) },
    radius: px(16),
    fill: "#38bdf8",
  })
  .followPath(
    trajectory.wave({
      start: { x: px(100), y: px(180) },
      end: { x: px(540), y: px(180) },
      amplitude: px(70),
      cycles: 2,
      phase: deg(0),
    }),
    { at: sec(0.5), duration: sec(4), easing: easing.easeInOut },
  );

export default project;
