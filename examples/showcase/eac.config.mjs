import {
  deg,
  easing,
  experience,
  hex,
  motion,
  opacity,
  parallel,
  px,
  schedule,
  sec,
  sequence,
  stagger,
  trajectory,
} from "@eac/core";

const project = experience({
  name: "showcase",
  width: px(640),
  height: px(360),
  duration: sec(6),
  fps: 30,
});

const scene = project.scene("main");

const title = scene.text("title", "Experience as Code", {
  position: { x: px(320), y: px(72) },
  fontSize: px(36),
  fontFamily: "Inter, sans-serif",
  fontWeight: 700,
  textAlign: "middle",
  letterSpacing: px(1),
  fill: hex("#38bdf8"),
  shadow: { offsetX: px(0), offsetY: px(6), blur: px(10), color: hex("#0008") },
  opacity: opacity(0),
});

const badge = scene.image("badge", {
  src: "assets/badge.svg",
  position: { x: px(320), y: px(210) },
  width: px(180),
  height: px(120),
  fit: "contain",
  scale: 0.85,
  opacity: opacity(0),
});

const orbit = scene.group("orbit", { position: { x: px(320), y: px(210) } });
const orbitStarts = [
  { x: px(250), y: px(0) },
  { x: px(-125), y: px(95.26) },
  { x: px(-125), y: px(-95.26) },
];
const satellites = ["#38bdf8", "#a78bfa", "#f472b6"].map((fill, index) =>
  orbit.circle(`satellite-${index}`, {
    position: orbitStarts[index],
    radius: px(10),
    fill,
    opacity: opacity(0.2),
  }),
);

satellites.forEach((satellite, index) =>
  satellite.followPath(
    trajectory.ellipse({
      center: { x: px(0), y: px(0) },
      radiusX: px(250),
      radiusY: px(110),
      startAngle: deg(index * 120),
      endAngle: deg(index * 120 + 360),
    }),
    { at: sec(1), duration: sec(4.5), easing: easing.linear },
  ),
);

schedule(
  sequence(
    parallel(
      motion.fadeTo(title, opacity(1), { duration: sec(0.6), easing: easing.easeOut }),
      motion.fadeTo(badge, opacity(1), { duration: sec(0.6), easing: easing.easeOut }),
      motion.scaleTo(badge, 1, { duration: sec(0.6), easing: easing.easeOut }),
    ),
    stagger(satellites, sec(0.1), (satellite) =>
      motion.fadeTo(satellite, opacity(1), { duration: sec(0.3), easing: easing.easeOut }),
    ),
    motion.colorTo(title, hex("#f472b6"), { duration: sec(1.2), easing: easing.easeInOut }),
  ),
  { at: sec(0.25) },
);

orbit.rotateTo(deg(10), { at: sec(1), duration: sec(1.5), easing: easing.easeInOut });

scene.audio("assets/sting.wav", {
  id: "sting",
  at: sec(0.3),
  duration: sec(0.6),
  volume: 0.4,
  fadeIn: sec(0.05),
  fadeOut: sec(0.2),
});

export default project;
