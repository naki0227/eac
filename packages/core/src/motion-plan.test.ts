import { describe, expect, it } from "vitest";
import {
  deg,
  delay,
  experience,
  motion,
  opacity,
  parallel,
  presets,
  px,
  schedule,
  sec,
  sequence,
  stagger,
} from "./index.js";

describe("immutable motion plans", () => {
  it("derives cumulative sequence offsets and lowers ordinary writes", () => {
    const project = experience({
      name: "sequence",
      width: px(200),
      height: px(100),
      duration: sec(4),
    });
    const dot = project
      .scene("main")
      .circle("dot", { position: { x: px(0), y: px(0) }, radius: px(4), fill: "red" });
    const plan = sequence(
      motion.moveTo(dot, { x: px(50), y: px(0) }, { duration: sec(0.5) }),
      delay(sec(0.25)),
      motion.rotateTo(dot, deg(90), { duration: sec(1) }),
    );
    schedule(plan, { at: sec(1) });

    expect(plan.duration).toEqual(sec(1.75));
    expect(dot.ir.properties.position.segments[0]?.start).toEqual(sec(1));
    expect(dot.ir.properties.rotation.segments[0]?.start).toEqual(sec(1.75));
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.operations)).toBe(true);
  });

  it("starts parallel motions together and uses the longest duration", () => {
    const project = experience({
      name: "parallel",
      width: px(100),
      height: px(100),
      duration: sec(3),
    });
    const group = project.scene("main").group("group");
    const plan = parallel(
      motion.rotateTo(group, deg(180), { duration: sec(2) }),
      motion.scaleTo(group, 2, { duration: sec(1) }),
    );
    schedule(plan, { at: sec(0.5) });

    expect(plan.duration).toEqual(sec(2));
    expect(group.ir.properties.rotation.segments[0]?.start).toEqual(sec(0.5));
    expect(group.ir.properties.scale.segments[0]?.start).toEqual(sec(0.5));
  });

  it("staggers a stable input array by index", () => {
    const project = experience({
      name: "stagger",
      width: px(300),
      height: px(100),
      duration: sec(3),
    });
    const scene = project.scene("main");
    const dots = [0, 1, 2].map((index) =>
      scene.circle(`dot-${index}`, {
        position: { x: px(40 + index * 80), y: px(50) },
        radius: px(8),
        fill: "red",
      }),
    );
    const plan = stagger(dots, sec(0.2), (dot) =>
      motion.fadeTo(dot, opacity(0), { duration: sec(0.5) }),
    );
    schedule(plan, { at: sec(1) });

    expect(plan.duration).toEqual(sec(0.9));
    expect(dots.map((dot) => dot.ir.properties.opacity.segments[0]?.start.value)).toEqual([
      1, 1.2, 1.4,
    ]);
  });

  it("rejects zero-length atomic motions and negative composition offsets", () => {
    const project = experience({
      name: "invalid",
      width: px(10),
      height: px(10),
      duration: sec(1),
    });
    const group = project.scene("main").group("group");
    expect(() => motion.scaleTo(group, 2, { duration: sec(0) })).toThrow("positive");
    expect(() => delay(sec(-1))).toThrow("non-negative");
  });

  it("implements reusable presets through ordinary public motion plans", () => {
    const project = experience({
      name: "preset",
      width: px(100),
      height: px(100),
      duration: sec(1),
    });
    const dot = project.scene("main").circle("dot", {
      position: { x: px(50), y: px(74) },
      radius: px(4),
      fill: "red",
      opacity: opacity(0),
      scale: 0.8,
    });
    schedule(presets.riseIn(dot, { duration: sec(0.5), distance: px(24) }));

    expect(dot.ir.properties.opacity.segments[0]?.target).toEqual(opacity(1));
    expect(dot.ir.properties.position.segments[0]?.target).toEqual({ x: px(50), y: px(50) });
  });
});
