import { deg, experience, opacity, px, sec } from "@eac/core";

const project = experience({
  name: "coordinated-motion",
  width: px(960),
  height: px(540),
  duration: sec(6),
  fps: 30,
});

const scene = project.scene("main");

// Each object has at most one writer for each animated property. The three
// motions overlap intentionally: position, rotation, and opacity are distinct
// properties, so they can be evaluated together without a writer conflict.
scene
  .rect("violet-card", {
    position: { x: px(120), y: px(130) },
    width: px(120),
    height: px(72),
    cornerRadius: px(16),
    fill: "#8b5cf6",
    rotation: deg(-12),
    opacity: opacity(0.15),
  })
  .moveTo(
    { x: px(800), y: px(130) },
    {
      at: sec(0.5),
      duration: sec(4.5),
      trajectory: {
        kind: "bezier",
        control1: { x: px(300), y: px(40) },
        control2: { x: px(620), y: px(220) },
      },
    },
  )
  .rotateTo(deg(348), { at: sec(0.5), duration: sec(4.5) })
  .fadeTo(opacity(1), { at: sec(0.5), duration: sec(1.25) });

scene
  .path(
    "coral-diamond",
    [
      { x: px(0), y: px(-48) },
      { x: px(48), y: px(0) },
      { x: px(0), y: px(48) },
      { x: px(-48), y: px(0) },
    ],
    {
      position: { x: px(820), y: px(280) },
      closed: true,
      fill: "#fb7185",
      stroke: "#fff1f2",
      strokeWidth: px(5),
      rotation: deg(0),
      opacity: opacity(1),
    },
  )
  .moveTo(
    { x: px(140), y: px(280) },
    {
      at: sec(0.75),
      duration: sec(4),
      trajectory: { kind: "cycloid", radius: px(26), turns: 2 },
    },
  )
  .rotateTo(deg(-270), { at: sec(0.75), duration: sec(4) })
  .fadeTo(opacity(0.25), { at: sec(3.5), duration: sec(1.25) });

scene
  .rect("gold-bar", {
    position: { x: px(140), y: px(420) },
    width: px(150),
    height: px(38),
    cornerRadius: px(19),
    fill: "#fbbf24",
    rotation: deg(8),
    opacity: opacity(0.2),
  })
  .moveTo(
    { x: px(790), y: px(420) },
    { at: sec(1), duration: sec(3.75), trajectory: { kind: "linear" } },
  )
  .rotateTo(deg(188), { at: sec(1), duration: sec(3.75) })
  .fadeTo(opacity(1), { at: sec(1), duration: sec(1) });

export default project;
