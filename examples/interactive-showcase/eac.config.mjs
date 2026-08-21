import {
  clamp,
  div,
  easing,
  experience,
  hex,
  hover,
  onClick,
  opacity,
  playSound,
  px,
  scroll,
  sec,
  sub,
  toggle,
  when,
} from "@eac/core";

const project = experience({
  name: "interactive-showcase",
  width: px(720),
  height: px(404),
  duration: sec(8),
  fps: 30,
});

const scene = project.scene("main");
const detail = scene.state("detail", false);

// A timed intro still runs: Timed and Reactive drive different properties of different nodes.
const title = scene.text("title", "Experience as Code", {
  position: { x: px(360), y: px(70) },
  fontSize: px(34),
  fontWeight: 700,
  textAlign: "middle",
  fill: hex("#38bdf8"),
  opacity: opacity(0),
  interactive: false,
});
title.fadeTo(opacity(1), { at: sec(0.2), duration: sec(0.8), easing: easing.easeOut });

const cards = scene.group("cards", { position: { x: px(360), y: px(200) } });
const badge = cards.image("badge", {
  src: "assets/badge.svg",
  position: { x: px(-200), y: px(0) },
  width: px(150),
  height: px(100),
  fit: "contain",
});
const toggleCard = cards.rect("toggle", {
  position: { x: px(0), y: px(0) },
  width: px(170),
  height: px(110),
  cornerRadius: px(14),
  fill: hex("#1e293b"),
  shadow: { offsetX: px(0), offsetY: px(8), blur: px(16), color: hex("#0009") },
});
const detailPanel = cards.rect("detail", {
  position: { x: px(210), y: px(0) },
  width: px(180),
  height: px(120),
  cornerRadius: px(14),
  fill: hex("#f472b6"),
  opacity: opacity(0),
});

const click = scene.sound("click", "assets/click.wav", { duration: sec(0.35), volume: 0.35 });

scene.bind(badge, { scale: when(hover(badge), 1.1, 1) });
scene.bind(toggleCard, {
  scale: when(hover(toggleCard), 1.08, 1),
  fill: { from: hex("#1e293b"), to: hex("#38bdf8"), progress: when(hover(toggleCard), 1, 0) },
});
scene.bind(detailPanel, { opacity: when(detail.value, 1, 0) });

// Scroll parallaxes the whole card row without a layout engine.
scene.bind(cards, { position: { x: 360, y: sub(200, div(scroll.y, 8)) } });

const hint = scene.text("hint", "hover · click · scroll", {
  position: { x: px(360), y: px(370) },
  fontSize: px(16),
  textAlign: "middle",
  fill: hex("#64748b"),
  interactive: false,
});
scene.bind(hint, { opacity: clamp(sub(1, div(scroll.y, 240)), 0.2, 1) });

scene.on(onClick(toggleCard), [toggle(detail), playSound(click)]);

export default project;
