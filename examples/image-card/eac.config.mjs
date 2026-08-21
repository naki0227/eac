import { deg, easing, experience, px, sec } from "@eac/core";

const project = experience({
  name: "image-card",
  width: px(640),
  height: px(360),
  duration: sec(3),
  fps: 30,
});

project
  .scene("main")
  .image("badge", {
    src: "assets/badge.svg",
    position: { x: px(320), y: px(180) },
    width: px(300),
    height: px(200),
    fit: "contain",
    shadow: { offsetX: px(0), offsetY: px(12), blur: px(18), color: "#0008" },
    scale: 0.8,
  })
  .scaleTo(1, { at: sec(0.25), duration: sec(0.75), easing: easing.easeOut })
  .rotateBy(deg(4), {
    at: sec(1),
    duration: sec(0.3),
    easing: easing.easeInOut,
  });

export default project;
