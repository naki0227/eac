import { deg, experience, opacity, px, sec } from "@eac/core";

const project = experience({
  name: "coordinated-motion",
  width: px(1280),
  height: px(720),
  duration: sec(6),
  fps: 30,
});

const scene = project.scene("main");

scene
  .rect("coral-card", {
    position: { x: px(180), y: px(180) },
    width: px(150),
    height: px(100),
    cornerRadius: px(20),
    fill: "#fb7185",
    rotation: deg(-12),
    opacity: opacity(0),
  })
  .moveTo(
    { x: px(1040), y: px(500) },
    {
      at: sec(0.5),
      duration: sec(4),
      trajectory: {
        kind: "bezier",
        control1: { x: px(400), y: px(40) },
        control2: { x: px(820), y: px(650) },
      },
    },
  )
  .rotateTo(deg(348), { at: sec(0.5), duration: sec(4) })
  .fadeTo(opacity(1), { at: sec(0.5), duration: sec(1) })
  .fadeTo(opacity(0.15), { at: sec(4.5), duration: sec(1) });

scene
  .circle("violet-orb", {
    position: { x: px(1080), y: px(180) },
    radius: px(52),
    fill: "#8b5cf6",
    rotation: deg(0),
    opacity: opacity(0.2),
  })
  .moveTo(
    { x: px(240), y: px(520) },
    {
      at: sec(0.75),
      duration: sec(3.75),
      trajectory: { kind: "cycloid", radius: px(34), turns: 2 },
    },
  )
  .rotateTo(deg(-540), { at: sec(0.75), duration: sec(3.75) })
  .fadeTo(opacity(1), { at: sec(0.75), duration: sec(1.25) })
  .fadeTo(opacity(0), { at: sec(4.5), duration: sec(1) });

scene
  .text("moving-title", "MOVE  ROTATE  FADE", {
    position: { x: px(640), y: px(600) },
    fontSize: px(42),
    width: px(520),
    fill: "#0f766e",
    rotation: deg(6),
    opacity: opacity(0),
  })
  .moveTo(
    { x: px(640), y: px(340) },
    { at: sec(1), duration: sec(3.25), trajectory: { kind: "linear" } },
  )
  .rotateTo(deg(-6), { at: sec(1), duration: sec(3.25) })
  .fadeTo(opacity(1), { at: sec(1), duration: sec(1) })
  .fadeTo(opacity(0.35), { at: sec(4.25), duration: sec(1.25) });

export default project;
