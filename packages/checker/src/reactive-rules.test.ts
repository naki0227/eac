import {
  experience,
  hover,
  onClick,
  onKeyDown,
  opacity,
  px,
  scenario,
  sec,
  setState,
  toggle,
  when,
  type ExperienceIR,
  type ScenarioIR,
} from "@eac/core";
import { describe, expect, it } from "vitest";
import { checkExperience } from "./index.js";

type Scene = ReturnType<ReturnType<typeof experience>["scene"]>;

function build(define: (scene: Scene) => void): ExperienceIR {
  const value = experience({
    name: "reactive",
    width: px(400),
    height: px(300),
    duration: sec(4),
    fps: 10,
  });
  define(value.scene("main"));
  return value.build();
}

const card = (scene: Scene, id = "card"): ReturnType<Scene["rect"]> =>
  scene.rect(id, {
    position: { x: px(200), y: px(150) },
    width: px(100),
    height: px(60),
    fill: "#ffffff",
  });

const ids = (value: ExperienceIR, trace?: ScenarioIR): readonly string[] => [
  ...new Set(checkExperience(value, trace).diagnostics.map(({ id }) => id)),
];

describe("reactive checker", () => {
  it("accepts the hover-scale interaction that the phase model makes safe", () => {
    const value = build((scene) => {
      const node = card(scene);
      scene.bind(node, { scale: when(hover(node), 1.05, 1) });
    });

    expect(checkExperience(value).errors).toBe(0);
  });

  it("reports a signal that does not exist", () => {
    expect(
      ids(
        build((scene) => {
          scene.bind(card(scene), { scale: when(hover("ghost"), 1.05, 1) });
        }),
      ),
    ).toContain("eac::reactive::undefined-signal");
  });

  it("reports a boolean expression bound to a numeric property", () => {
    expect(
      ids(
        build((scene) => {
          const node = card(scene);
          scene.bind(node, { opacity: hover(node) });
        }),
      ),
    ).toContain("eac::reactive::type-mismatch");
  });

  it("refuses a property driven by both a timed writer and a binding", () => {
    expect(
      ids(
        build((scene) => {
          const node = card(scene);
          node.fadeTo(opacity(0.5), { at: sec(1), duration: sec(1) });
          scene.bind(node, { opacity: when(hover(node), 1, 0) });
        }),
      ),
    ).toContain("eac::reactive::mixed-property-writers");
  });

  it("refuses two reactive bindings on one property", () => {
    expect(
      ids(
        build((scene) => {
          const node = card(scene);
          scene.bind(node, { opacity: when(hover(node), 1, 0) });
          scene.bind(node, { opacity: 0.5 });
        }),
      ),
    ).toContain("eac::reactive::mixed-property-writers");
  });

  it("refuses two rules that write one state on the same trigger", () => {
    expect(
      ids(
        build((scene) => {
          const node = card(scene);
          const open = scene.state("open", false);
          scene.on(onClick(node), toggle(open));
          scene.on(onClick(node), setState(open, true));
        }),
      ),
    ).toContain("eac::reactive::multiple-state-writers");
  });

  it("reports duplicate state names and unknown rule targets", () => {
    expect(
      ids(
        build((scene) => {
          card(scene);
          scene.state("open", false);
          scene.state("open", true);
        }),
      ),
    ).toContain("eac::state::duplicate-name");
    expect(
      ids(
        build((scene) => {
          card(scene);
          const open = scene.state("open", false);
          scene.on(onClick("ghost"), toggle(open));
        }),
      ),
    ).toContain("eac::reactive::invalid-hit-target");
  });

  it("detects a self-referential expression instead of overflowing the stack", () => {
    const value = build((scene) => {
      const node = card(scene);
      const selfReferential: Record<string, unknown> = {
        kind: "add",
        left: { kind: "const", value: 1 },
      };
      selfReferential.right = selfReferential;
      scene.reactive.bindings.push({
        id: "loop",
        node: node.ir.id,
        property: "opacity",
        value: selfReferential as never,
      });
    });

    expect(ids(value)).toContain("eac::reactive::cycle");
  });

  it("validates scenario timing, targets, and assertion outcomes", () => {
    const value = build((scene) => {
      const node = card(scene);
      const open = scene.state("open", false);
      scene.on(onClick(node), toggle(open));
      scene.on(onKeyDown("Escape"), setState(open, false));
      scene.bind(node, { opacity: when(open.value, 1, 0.5) });
    });
    const trace = (define: (builder: ReturnType<typeof scenario>) => void): ScenarioIR => {
      const builder = scenario("trace", { duration: sec(4) });
      define(builder);
      return builder.build();
    };

    expect(
      ids(
        value,
        trace((builder) => builder.pointerMove(sec(9), px(1), px(1))),
      ),
    ).toContain("eac::scenario::out-of-range");
    expect(
      ids(
        value,
        trace((builder) => builder.pointerMove(sec(-1), px(1), px(1))),
      ),
    ).toContain("eac::scenario::invalid-time");
    expect(
      ids(
        value,
        trace((builder) => builder.expectState(sec(1), "ghost", true)),
      ),
    ).toContain("eac::scenario::unknown-target");
    expect(
      ids(
        value,
        trace((builder) => {
          builder.click(sec(1), px(200), px(150));
          builder.expectState(sec(2), "open", false);
        }),
      ),
    ).toContain("eac::scenario::assertion-failed");

    const passing = trace((builder) => {
      builder.click(sec(1), px(200), px(150));
      builder.expectState(sec(2), "open", true);
      builder.expectHover(sec(2), "card", true);
      builder.expectProperty(sec(2), "card", "opacity", 1);
    });
    const result = checkExperience(value, passing);

    expect(result.errors).toBe(0);
    expect(result.scenario).toMatchObject({ assertions: 3, failedAssertions: 0 });
  });
});
