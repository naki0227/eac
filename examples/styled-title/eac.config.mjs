import { easing, experience, hex, px, sec } from "@eac/core";

const project = experience({
  name: "styled-title",
  width: px(640),
  height: px(360),
  duration: sec(3),
  fps: 30,
});

const title = project.scene("main").text("title", "Experience as Code", {
  position: { x: px(320), y: px(190) },
  fontSize: px(48),
  fontFamily: "Inter, sans-serif",
  fontWeight: 700,
  textAlign: "middle",
  letterSpacing: px(2),
  fill: hex("#38bdf8"),
  stroke: hex("#0f172a"),
  strokeWidth: px(1),
  shadow: { offsetX: px(0), offsetY: px(8), blur: px(12), color: hex("#0008") },
});

title
  .colorTo(hex("#f472b6"), {
    at: sec(0.5),
    duration: sec(1.5),
    easing: easing.easeInOut,
  })
  .blurTo(px(2), { at: sec(2), duration: sec(0.5), easing: easing.easeOut });

export default project;
