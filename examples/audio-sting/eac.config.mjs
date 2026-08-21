import { easing, experience, hex, opacity, px, sec } from "@eac/core";

const project = experience({
  name: "audio-sting",
  width: px(320),
  height: px(180),
  duration: sec(1.5),
  fps: 10,
});

const scene = project.scene("main");
scene
  .text("title", "EaC", {
    position: { x: px(160), y: px(100) },
    fontSize: px(48),
    fill: hex("#38bdf8"),
    textAlign: "middle",
    opacity: opacity(0),
    scale: 0.8,
  })
  .fadeTo(opacity(1), { at: sec(0.2), duration: sec(0.3), easing: easing.easeOut })
  .scaleTo(1, { at: sec(0.2), duration: sec(0.3), easing: easing.easeOut });

scene.audio("assets/sting.wav", {
  id: "sting",
  at: sec(0.35),
  duration: sec(0.6),
  volume: 0.45,
  fadeIn: sec(0.03),
  fadeOut: sec(0.15),
});

export default project;
