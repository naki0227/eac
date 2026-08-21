import { experience, hex, hover, px, sec, when } from "@eac/core";

const project = experience({
  name: "hover-card",
  width: px(640),
  height: px(360),
  duration: sec(4),
  fps: 30,
});

const scene = project.scene("main");

const card = scene.rect("card", {
  position: { x: px(320), y: px(180) },
  width: px(220),
  height: px(140),
  cornerRadius: px(16),
  fill: hex("#1e293b"),
  shadow: { offsetX: px(0), offsetY: px(10), blur: px(18), color: hex("#0008") },
});

// Hover is derived from pointer geometry, not from a browser boolean.
scene.bind(card, {
  scale: when(hover(card), 1.08, 1),
  fill: { from: hex("#1e293b"), to: hex("#334155"), progress: when(hover(card), 1, 0) },
});

export default project;
