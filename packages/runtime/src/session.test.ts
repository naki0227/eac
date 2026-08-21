import {
  experience,
  hover,
  onClick,
  onKeyDown,
  opacity,
  px,
  scenario,
  sec,
  toggle,
  when,
  type ExperienceIR,
  type ScenarioIR,
} from "@eac/core";
import { describe, expect, it } from "vitest";
import { ExperienceSession } from "./index.js";

function project(): ExperienceIR {
  const value = experience({
    name: "interactive",
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
  const open = scene.state("open", false);
  const panel = scene.rect("panel", {
    position: { x: px(60), y: px(50) },
    width: px(80),
    height: px(40),
    fill: "#f472b6",
    opacity: opacity(0),
  });
  scene.bind(card, { scale: when(hover(card), 1.2, 1) });
  scene.bind(panel, { opacity: when(open.value, 1, 0) });
  scene.on(onClick(card), toggle(open));
  scene.on(onKeyDown("Escape"), toggle(open), { when: open.value });
  return value.build();
}

function trace(): ScenarioIR {
  return scenario("trace", { duration: sec(4) }, (builder) => {
    builder.pointerMove(sec(1), px(200), px(150));
    builder.pointerDown(sec(1.5));
    builder.pointerUp(sec(1.6));
    builder.keyDown(sec(2), "Escape");
    builder.pointerMove(sec(2.5), px(10), px(10));
  }).build();
}

const stateAt = (session: ExperienceSession, time: number): unknown =>
  session.replayTo(time).state.states.open;

describe("reactive replay", () => {
  it("derives hover from geometry and reflects it in the evaluated scene", () => {
    const session = new ExperienceSession(project(), trace());

    expect(session.replayTo(0.5).state.hoverTarget).toBeUndefined();
    expect(session.replayTo(1).state.hoverTarget).toBe("card");
    expect(session.evaluateAt(1).find((item) => item.object.id === "card")?.matrix[0]).toBeCloseTo(
      1.2,
      10,
    );
    expect(session.replayTo(2.5).state.hoverTarget).toBeUndefined();
  });

  it("turns a down/up gesture on one target into a click that toggles state", () => {
    const session = new ExperienceSession(project(), trace());

    expect(stateAt(session, 1.5)).toBe(false);
    expect(stateAt(session, 1.6)).toBe(true);
    expect(
      session.replayTo(4).transitions.map((item) => `${item.event}:${item.to.toString()}`),
    ).toEqual(["click:true", "keyDown:false"]);
  });

  it("honours a guard so a rule only fires while its condition holds", () => {
    const guarded = scenario("guarded", { duration: sec(4) }, (builder) => {
      builder.keyDown(sec(1), "Escape");
    }).build();

    expect(new ExperienceSession(project(), guarded).replayTo(4).transitions).toEqual([]);
  });

  it("produces identical results with a warm cache and from a cold start", () => {
    const session = new ExperienceSession(project(), trace());
    const times = [3.9, 0.2, 2.2, 1.55, 3.1, 0.9];
    for (const time of times) session.replayTo(time);

    for (const time of times)
      expect(session.replayTo(time).state).toEqual(session.replayFresh(time).state);
  });

  it("gives the same state whether the timeline is seeked forward or backward", () => {
    const forward = new ExperienceSession(project(), trace());
    const backward = new ExperienceSession(project(), trace());
    const times = [0.5, 1, 1.6, 2, 2.5, 3, 4];
    const seen = times.map((time) => JSON.stringify(forward.replayTo(time).state));
    const reversed = [...times]
      .reverse()
      .map((time) => JSON.stringify(backward.replayTo(time).state))
      .reverse();

    expect(reversed).toEqual(seen);
  });

  it("evaluates a scene with no reactive content exactly as a timed scene", () => {
    const value = experience({ name: "timed", width: px(100), height: px(100), duration: sec(1) });
    value
      .scene("main")
      .circle("dot", { position: { x: px(10), y: px(10) }, radius: px(5), fill: "#fff" })
      .moveTo({ x: px(90), y: px(90) }, { at: sec(0), duration: sec(1) });
    const ir = value.build();
    const session = new ExperienceSession(ir);

    expect(session.evaluateAt(0.5)[0]?.matrix[4]).toBeCloseTo(50, 10);
    expect(session.replayTo(1).transitions).toEqual([]);
  });
});
