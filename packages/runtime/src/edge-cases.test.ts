import {
  experience,
  hover,
  onClick,
  onKeyDown,
  onScroll,
  opacity,
  px,
  scenario,
  scroll,
  sec,
  setState,
  toggle,
  when,
  clamp,
  div,
  type ExperienceIR,
  type ScenarioIR,
} from "@eac/core";
import { describe, expect, it } from "vitest";
import { ExperienceSession } from "./index.js";

function project(): ExperienceIR {
  const value = experience({
    name: "edges",
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
  // A separate node carries the scroll binding: a zero-opacity node is deliberately not hittable,
  // so putting it on the card would make every pointer test vacuous.
  const bar = scene.rect("bar", {
    position: { x: px(40), y: px(40) },
    width: px(40),
    height: px(20),
    fill: "#f472b6",
  });
  const open = scene.state("open", false);
  const count = scene.state("count", 0);
  scene.bind(card, { scale: when(hover(card), 1.2, 1) });
  scene.bind(bar, { opacity: clamp(div(scroll.y, 100)) });
  scene.on(onClick(card), toggle(open));
  scene.on(onKeyDown("Space"), setState(count, 1));
  scene.on(onScroll(), setState(count, 2));
  return value.build();
}

const trace = (define: (builder: ReturnType<typeof scenario>) => void): ScenarioIR => {
  const builder = scenario("edge", { duration: sec(4) });
  define(builder);
  return builder.build();
};

const inside = { x: px(200), y: px(150) };
const outside = { x: px(360), y: px(270) };

describe("replay edge cases", () => {
  it("replays an empty scenario without changing anything", () => {
    const session = new ExperienceSession(
      project(),
      trace(() => undefined),
    );
    const result = session.replayTo(4);

    expect(result.transitions).toEqual([]);
    expect(result.state.states).toEqual({ open: false, count: 0 });
  });

  it("applies same-time events in their authored order", () => {
    const session = new ExperienceSession(
      project(),
      trace((builder) => {
        builder.pointerMove(sec(1), inside.x, inside.y);
        builder.pointerDown(sec(1));
        builder.pointerUp(sec(1));
      }),
    );

    expect(session.replayTo(4).transitions.map((item) => item.event)).toEqual(["click"]);
  });

  it("does not click when the pointer moves off the target between down and up", () => {
    const session = new ExperienceSession(
      project(),
      trace((builder) => {
        builder.pointerMove(sec(1), inside.x, inside.y);
        builder.pointerDown(sec(1.2));
        builder.pointerMove(sec(1.4), outside.x, outside.y);
        builder.pointerUp(sec(1.6));
      }),
    );

    expect(session.replayTo(4).transitions).toEqual([]);
  });

  it("emits leave and enter when the pointer leaves and returns", () => {
    const session = new ExperienceSession(
      project(),
      trace((builder) => {
        builder.pointerMove(sec(1), inside.x, inside.y);
        builder.pointerMove(sec(1.5), outside.x, outside.y);
        builder.pointerMove(sec(2), inside.x, inside.y);
        builder.pointerLeave(sec(2.5));
      }),
    );
    const names = session
      .replayTo(4)
      .events.map((item) => `${item.event.name}:${item.event.target ?? "-"}`);

    expect(names).toEqual([
      "pointerEnter:card",
      "pointerLeave:card",
      "pointerEnter:card",
      "pointerLeave:card",
    ]);
    expect(session.replayTo(4).state.hoverTarget).toBeUndefined();
  });

  it("ignores a duplicate key down and a key up that was never down", () => {
    const session = new ExperienceSession(
      project(),
      trace((builder) => {
        builder.keyDown(sec(1), "Space");
        builder.keyDown(sec(1.5), "Space");
        builder.keyUp(sec(2), "Space");
        builder.keyUp(sec(2.5), "Space");
      }),
    );

    expect(session.replayTo(4).events.filter((item) => item.event.name === "keyDown")).toHaveLength(
      1,
    );
    expect(session.replayTo(4).events.filter((item) => item.event.name === "keyUp")).toHaveLength(
      1,
    );
  });

  it("accepts a negative scroll offset without producing a non-finite value", () => {
    const session = new ExperienceSession(
      project(),
      trace((builder) => {
        builder.scrollTo(sec(1), px(0), px(-500));
      }),
    );
    const card = session.evaluateAt(2).find((item) => item.object.id === "bar");

    expect(card?.opacity).toBe(0);
    expect(Number.isFinite(card?.opacity ?? Number.NaN)).toBe(true);
  });

  it("holds the final state past the end of the scenario", () => {
    const session = new ExperienceSession(
      project(),
      trace((builder) => {
        builder.click(sec(1), inside.x, inside.y);
      }),
    );

    expect(session.replayTo(4).state.states.open).toBe(true);
    expect(session.replayTo(99).state.states.open).toBe(true);
  });

  it("returns the initial state before any step has run", () => {
    const session = new ExperienceSession(
      project(),
      trace((builder) => {
        builder.click(sec(1), inside.x, inside.y);
      }),
    );

    expect(session.replayTo(-1).state.states).toEqual({ open: false, count: 0 });
  });

  it("gives identical results when the same time is replayed repeatedly", () => {
    const session = new ExperienceSession(
      project(),
      trace((builder) => {
        builder.pointerMove(sec(0.5), inside.x, inside.y);
        builder.click(sec(1.5));
        builder.scrollTo(sec(2.5), px(0), px(60));
      }),
    );
    const first = JSON.stringify(session.replayTo(3).state);

    for (let repeat = 0; repeat < 5; repeat += 1)
      expect(JSON.stringify(session.replayTo(3).state)).toBe(first);
  });

  it("keeps hover stable when a binding scales the node the pointer is over", () => {
    // The card grows on hover. Because hit-testing freezes geometry before the step's own reactive
    // output, this settles instead of oscillating between hovered and unhovered.
    const session = new ExperienceSession(
      project(),
      trace((builder) => {
        builder.pointerMove(sec(1), inside.x, inside.y);
      }),
    );
    const hovered = [1.2, 1.5, 2, 3, 4].map(
      (time) => session.replayTo(time).state.hoverTarget ?? "-",
    );

    expect(hovered).toEqual(["card", "card", "card", "card", "card"]);
  });

  it("reports colliding state writes rather than resolving them silently", () => {
    const value = experience({
      name: "collide",
      width: px(200),
      height: px(200),
      duration: sec(2),
      fps: 10,
    });
    const scene = value.scene("main");
    const node = scene.rect("card", {
      position: { x: px(100), y: px(100) },
      width: px(80),
      height: px(80),
      fill: "#fff",
    });
    const flag = scene.state("flag", false);
    scene.on(onClick(node), toggle(flag));
    scene.on(onClick(node), setState(flag, true));
    const session = new ExperienceSession(
      value.build(),
      scenario("collide", { duration: sec(2) }, (builder) => {
        builder.click(sec(1), px(100), px(100));
      }).build(),
    );

    expect(session.replayTo(2).conflicts).toEqual([
      { scene: "main", state: "flag", rules: ["rule-1", "rule-2"], at: 1.000001 },
    ]);
  });

  it("never targets a node that is hidden by a zero opacity binding", () => {
    const value = experience({
      name: "hidden",
      width: px(200),
      height: px(200),
      duration: sec(2),
      fps: 10,
    });
    const scene = value.scene("main");
    const node = scene.rect("ghost", {
      position: { x: px(100), y: px(100) },
      width: px(80),
      height: px(80),
      fill: "#fff",
      opacity: opacity(0),
    });
    scene.on(onClick(node), toggle(scene.state("seen", false)));
    const session = new ExperienceSession(
      value.build(),
      scenario("hidden", { duration: sec(2) }, (builder) => {
        builder.click(sec(1), px(100), px(100));
      }).build(),
    );

    expect(session.replayTo(2).state.hoverTarget).toBeUndefined();
    expect(session.replayTo(2).transitions).toEqual([]);
  });
});
