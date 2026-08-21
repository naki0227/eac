import { clamp, div, experience, hex, px, scroll, sec, sub } from "@eac/core";

const project = experience({
  name: "scroll-header",
  width: px(640),
  height: px(360),
  duration: sec(4),
  fps: 30,
});

const scene = project.scene("main");

// Scroll is an explicit input signal, not a hidden browser scroll container.
const fade = clamp(sub(1, div(scroll.y, 300)));

const header = scene.rect("header", {
  position: { x: px(320), y: px(48) },
  width: px(560),
  height: px(72),
  cornerRadius: px(8),
  fill: hex("#38bdf8"),
});

const title = scene.text("title", "Scroll to fade the header", {
  position: { x: px(320), y: px(200) },
  fontSize: px(28),
  textAlign: "middle",
  fill: hex("#e2e8f0"),
  interactive: false,
});

scene.bind(header, { opacity: fade, position: { x: 320, y: sub(48, div(scroll.y, 6)) } });
scene.bind(title, { opacity: clamp(div(scroll.y, 200)) });

export default project;
