import {
  clamp,
  div,
  experience,
  hover,
  onClick,
  onKeyDown,
  opacity,
  px,
  scroll,
  sec,
  setState,
  toggle,
  when,
  type ExperienceIR,
  type ScenarioEventPayload,
} from "@eac/core";
import { describe, expect, it } from "vitest";
import { ExperienceSession, LiveSession } from "./index.js";
import {
  keyDown,
  keyUp,
  pointerDown,
  pointerLeave,
  pointerMove,
  pointerUp,
  scrollTo,
} from "./browser.js";

function project(): ExperienceIR {
  const value = experience({
    name: "live",
    width: px(400),
    height: px(300),
    duration: sec(4),
    fps: 10,
  });
  const scene = value.scene("main");
  const card = scene.rect("card", {
    position: { x: px(200), y: px(150) },
    width: px(120),
    height: px(80),
    fill: "#38bdf8",
  });
  const panel = scene.rect("panel", {
    position: { x: px(60), y: px(40) },
    width: px(60),
    height: px(40),
    fill: "#f472b6",
    opacity: opacity(0),
  });
  const open = scene.state("open", false);
  const nudged = scene.state("nudged", 0);
  scene.bind(card, { scale: when(hover(card), 1.2, 1) });
  scene.bind(panel, { opacity: when(open.value, 1, 0) });
  scene.bind(card, { rotation: clamp(div(scroll.y, 10), 0, 30) });
  scene.on(onClick(card), toggle(open));
  scene.on(onKeyDown("KeyN"), setState(nudged, 1));
  return value.build();
}

/** A recorded interaction expressed as (frame, inputs), exactly what the DOM adapter produces. */
const INTERACTION: readonly (readonly [number, readonly ScenarioEventPayload[]])[] = [
  [5, [pointerMove({ x: 200, y: 150 })]],
  [8, [pointerDown()]],
  [9, [pointerUp()]],
  [12, [scrollTo(0, 120)]],
  [15, [keyDown("KeyN")]],
  [16, [keyUp("KeyN")]],
  [20, [pointerMove({ x: 10, y: 10 })]],
  [24, [pointerLeave()]],
];

function drive(session: LiveSession): void {
  for (const [frame, inputs] of INTERACTION) {
    for (const input of inputs) session.queue(input);
    session.advanceTo(frame);
  }
  session.advanceTo(session.lastFrame);
}

const canonical = (
  objects: readonly {
    object: { id: string };
    matrix: readonly number[];
    opacity: number;
    depth: number;
  }[],
): string =>
  JSON.stringify(
    objects.map((item) => ({
      id: item.object.id,
      matrix: item.matrix.map((value) => Number(value.toFixed(9))),
      opacity: Number(item.opacity.toFixed(9)),
      depth: item.depth,
    })),
  );

describe("live session", () => {
  it("reacts to pointer input without any scenario file", () => {
    const session = new LiveSession(project());

    session.queue(pointerMove({ x: 200, y: 150 }));
    session.advanceTo(5);

    expect(session.state.hoverTarget).toBe("card");
    expect(session.evaluate().find((item) => item.object.id === "card")?.matrix[0]).toBeCloseTo(
      1.2,
      10,
    );
  });

  it("derives click from down and up rather than being told about it", () => {
    const session = new LiveSession(project());

    session.queue(pointerMove({ x: 200, y: 150 }));
    session.advanceTo(3);
    session.queue(pointerDown());
    session.advanceTo(4);
    expect(session.state.states.open).toBe(false);
    expect(session.state.pressedTarget).toBe("card");

    session.queue(pointerUp());
    session.advanceTo(5);
    expect(session.state.states.open).toBe(true);
    expect(session.evaluate().find((item) => item.object.id === "panel")?.opacity).toBe(1);
  });

  it("routes keyboard and scroll through the same runtime", () => {
    const session = new LiveSession(project());

    session.queue(scrollTo(0, 150));
    session.advanceTo(4);
    expect(session.state.scroll.y).toBe(150);
    expect(session.evaluate().find((item) => item.object.id === "card")?.matrix[1]).toBeGreaterThan(
      0,
    );

    session.queue(keyDown("KeyN"));
    session.advanceTo(6);
    expect(session.state.states.nudged).toBe(1);
    expect(session.state.keys).toEqual(["KeyN"]);
  });

  it("reproduces the live interaction exactly when the exported scenario is replayed", () => {
    const value = project();
    const live = new LiveSession(value);
    const liveFrames = new Map<number, string>();
    const liveStates = new Map<number, string>();

    for (const [frame, inputs] of INTERACTION) {
      for (const input of inputs) live.queue(input);
      live.advanceTo(frame);
    }
    live.advanceTo(live.lastFrame);
    for (let frame = 0; frame <= live.lastFrame; frame += 1) {
      live.advanceTo(frame);
      liveFrames.set(frame, canonical(live.evaluate()));
      liveStates.set(frame, JSON.stringify(live.state));
    }

    // A fresh session, given only the exported scenario, must agree at every frame.
    const replay = new ExperienceSession(value, live.scenario());
    for (let frame = 0; frame <= live.lastFrame; frame += 1) {
      const time = frame / live.fps;
      expect(canonical(replay.evaluateAt(time))).toBe(liveFrames.get(frame));
      expect(JSON.stringify(replay.replayTo(time).state)).toBe(liveStates.get(frame));
    }
  });

  it("quantizes input to the frame it is committed to", () => {
    const session = new LiveSession(project());
    session.queue(pointerMove({ x: 200, y: 150 }));
    session.advanceTo(7);

    const events = session.scenario().events;

    expect(events).toHaveLength(1);
    expect(events[0]?.at.value).toBeCloseTo(0.7, 10);
    expect(events[0]?.order).toBe(0);
  });

  it("scrubs backward without mutating the recorded history", () => {
    const session = new LiveSession(project());
    drive(session);
    const recorded = JSON.stringify(session.scenario());
    const atEnd = JSON.stringify(session.state);

    session.advanceTo(6);
    expect(session.state.hoverTarget).toBe("card");
    expect(session.state.states.open).toBe(false);

    session.advanceTo(session.lastFrame);
    expect(JSON.stringify(session.state)).toBe(atEnd);
    expect(JSON.stringify(session.scenario())).toBe(recorded);
  });

  it("restores everything on reset", () => {
    const session = new LiveSession(project());
    drive(session);
    session.reset();

    expect(session.frame).toBe(0);
    expect(session.time).toBe(0);
    expect(session.scenario().events).toEqual([]);
    expect(session.state.hoverTarget).toBeUndefined();
    expect(session.state.pressedTarget).toBeUndefined();
    expect(session.state.keys).toEqual([]);
    expect(session.state.scroll).toEqual({ x: 0, y: 0 });
    expect(session.state.states).toEqual({ open: false, nudged: 0 });
    expect(session.result.transitions).toEqual([]);
    expect(session.result.events).toEqual([]);
  });

  it("gives the same result whether or not checkpoints were warmed", () => {
    const value = project();
    const live = new LiveSession(value);
    drive(live);
    const scenario = live.scenario();

    const warm = new ExperienceSession(value, scenario);
    for (const time of [3.9, 0.4, 2.1, 1.2, 3.1]) warm.replayTo(time);
    const cold = new ExperienceSession(value, scenario);

    for (const time of [0, 0.5, 0.9, 1.6, 2.4, 3.3, 4])
      expect(JSON.stringify(warm.replayTo(time).state)).toBe(
        JSON.stringify(cold.replayFresh(time).state),
      );
  });
});
