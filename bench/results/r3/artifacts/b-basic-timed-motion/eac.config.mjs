import { deg, experience, opacity, px, sec } from "@eac/core";

const project = experience({
  name: "coordinated-motion",
  width: px(1280),
  height: px(720),
  duration: sec(6),
  fps: 30,
});

const scene = project.scene("main");

const coralCard = scene.rect("coral-card", {
  position: { x: px(150), y: px(145) },
  width: px(132),
  height: px(84),
  cornerRadius: px(18),
  fill: "#fb7185",
  stroke: "#fff1f2",
  rotation: deg(-12),
  opacity: opacity(1),
});

coralCard
  .moveTo(
    { x: px(1090), y: px(145) },
    {
      at: sec(0.5),
      duration: sec(4.5),
      trajectory: {
        kind: "bezier",
        control1: { x: px(420), y: px(55) },
        control2: { x: px(820), y: px(235) },
      },
    },
  )
  .rotateTo(deg(348), { at: sec(0.5), duration: sec(4.5) })
  .fadeTo(opacity(0.28), { at: sec(0.5), duration: sec(4.5) });

const blueTile = scene.rect("blue-tile", {
  position: { x: px(1090), y: px(360) },
  width: px(104),
  height: px(104),
  cornerRadius: px(24),
  fill: "#38bdf8",
  stroke: "#e0f2fe",
  rotation: deg(10),
  opacity: opacity(0.9),
});

blueTile
  .moveTo(
    { x: px(150), y: px(360) },
    {
      at: sec(0.75),
      duration: sec(4),
      trajectory: {
        kind: "bezier",
        control1: { x: px(830), y: px(275) },
        control2: { x: px(450), y: px(445) },
      },
    },
  )
  .rotateTo(deg(-350), { at: sec(0.75), duration: sec(4) })
  .fadeTo(opacity(0.35), { at: sec(0.75), duration: sec(4) });

const goldBar = scene.rect("gold-bar", {
  position: { x: px(170), y: px(575) },
  width: px(176),
  height: px(58),
  cornerRadius: px(29),
  fill: "#fbbf24",
  stroke: "#fffbeb",
  rotation: deg(0),
  opacity: opacity(0.25),
});

goldBar
  .moveTo({ x: px(1080), y: px(575) }, { at: sec(1), duration: sec(4) })
  .rotateTo(deg(180), { at: sec(1), duration: sec(4) })
  .fadeTo(opacity(1), { at: sec(1), duration: sec(4) });

const violetDot = scene.circle("violet-dot", {
  position: { x: px(640), y: px(360) },
  radius: px(38),
  fill: "#a78bfa",
  stroke: "#f5f3ff",
  rotation: deg(0),
  opacity: opacity(1),
});

violetDot
  .moveTo(
    { x: px(640), y: px(575) },
    {
      at: sec(1.25),
      duration: sec(3.5),
      trajectory: {
        kind: "bezier",
        control1: { x: px(480), y: px(405) },
        control2: { x: px(800), y: px(510) },
      },
    },
  )
  .rotateTo(deg(540), { at: sec(1.25), duration: sec(3.5) })
  .fadeTo(opacity(0.2), { at: sec(1.25), duration: sec(3.5) });

export default project;
