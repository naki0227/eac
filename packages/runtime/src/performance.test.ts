import {
  clamp,
  div,
  experience,
  hover,
  onClick,
  px,
  scenario,
  scroll,
  sec,
  toggle,
  when,
  type ExperienceIR,
} from "@eac/core";
import { describe, expect, it } from "vitest";
import { ExperienceSession } from "./index.js";

const NODES = 100;
const DURATION = 10;
const FPS = 30;

function stress(): ExperienceIR {
  const value = experience({
    name: "reactive-performance",
    width: px(1280),
    height: px(720),
    duration: sec(DURATION),
    fps: FPS,
  });
  const scene = value.scene("main");
  for (let index = 0; index < NODES; index += 1) {
    const node = scene.rect(`cell-${String(index)}`, {
      position: { x: px(40 + (index % 20) * 60), y: px(60 + Math.floor(index / 20) * 120) },
      width: px(48),
      height: px(48),
      fill: "#38bdf8",
    });
    // 50 reactive bindings plus 20 state-dependent ones over 100 nodes.
    if (index % 2 === 0) scene.bind(node, { scale: when(hover(node), 1.15, 1) });
    if (index % 5 === 0) {
      const open = scene.state(`open-${String(index)}`, false);
      scene.bind(node, { opacity: when(open.value, 1, 0.4) });
      scene.on(onClick(node), toggle(open));
    }
    if (index % 25 === 0) scene.bind(node, { rotation: clamp(div(scroll.y, 10), 0, 45) });
  }
  return value.build();
}

/**
 * Regression sanity check, not a published benchmark. It measures replay plus evaluated-scene
 * generation across a pointer sweep, so an accidental quadratic in the reactive graph shows up.
 */
describe("reactive performance sanity", () => {
  it("replays a pointer sweep over 100 nodes and 300 frames inside a bounded budget", () => {
    const value = stress();
    const trace = scenario("sweep", { duration: sec(DURATION) }, (builder) => {
      for (let step = 0; step < 60; step += 1)
        builder.pointerMove(sec(step * 0.15), px(40 + step * 18), px(180));
      builder.pointerDown(sec(9));
      builder.pointerUp(sec(9.1));
    }).build();
    const session = new ExperienceSession(value, trace);

    const started = performance.now();
    for (let frame = 0; frame <= DURATION * FPS; frame += 1) session.evaluateAt(frame / FPS);
    const elapsed = performance.now() - started;

    expect(session.steps.length).toBeGreaterThan(300);
    expect(elapsed).toBeLessThan(8_000);
  });

  it("does not re-derive the whole trace on every seek", () => {
    const value = stress();
    const trace = scenario("seek", { duration: sec(DURATION) }, (builder) => {
      for (let step = 0; step < 40; step += 1)
        builder.pointerMove(sec(step * 0.2), px(60 + step * 20), px(180));
    }).build();
    const session = new ExperienceSession(value, trace);

    session.replayTo(DURATION);
    const started = performance.now();
    for (let repeat = 0; repeat < 20; repeat += 1) session.replayTo(DURATION - repeat * 0.01);
    const elapsed = performance.now() - started;

    expect(elapsed).toBeLessThan(2_000);
  });
});
