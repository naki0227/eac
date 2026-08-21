import { createContext, runInContext } from "node:vm";
import {
  clamp,
  div,
  experience,
  hover,
  onClick,
  onKeyDown,
  opacity,
  px,
  scenario,
  scroll,
  sec,
  setState,
  toggle,
  when,
  type ExperienceIR,
  type ScenarioIR,
} from "@eac/core";
import { ExperienceSession } from "@eac/runtime";
import { beforeAll, describe, expect, it } from "vitest";
import { previewRuntimeBundle } from "./preview.js";

type Bundle = Readonly<{
  ExperienceSession: new (
    experience: unknown,
    scenario?: unknown,
  ) => {
    replayTo: (time: number) => { state: unknown };
    evaluateAt: (time: number) => readonly EvaluatedLike[];
  };
  reviveExperience: (value: unknown) => unknown;
  reviveScenario: (value: unknown) => unknown;
  renderSvg: (experience: unknown, time: number, overrides?: unknown) => string;
}>;

type EvaluatedLike = Readonly<{
  object: Readonly<{ id: string }>;
  matrix: readonly number[];
  opacity: number;
  depth: number;
}>;

/** The exact bytes shipped in the preview page, executed in an isolated global. */
let bundle: Bundle;
beforeAll(async () => {
  const source = await previewRuntimeBundle();
  const scope: Record<string, unknown> = {};
  scope.globalThis = scope;
  const context = createContext(scope);
  runInContext(source, context, { filename: "preview-runtime.js" });
  bundle = scope.EaCPreviewRuntime as Bundle;
});

function project(): ExperienceIR {
  const value = experience({
    name: "conformance",
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
  scene.bind(card, { rotation: clamp(div(scroll.y, 10), 0, 30) });
  scene.bind(panel, { opacity: when(open.value, 1, 0) });
  scene.on(onClick(card), toggle(open));
  scene.on(onKeyDown("KeyN"), setState(nudged, 1));
  return value.build();
}

function trace(): ScenarioIR {
  return scenario("conformance", { duration: sec(4) }, (input) => {
    input.pointerMove(sec(0.5), px(200), px(150));
    input.pointerDown(sec(1));
    input.pointerUp(sec(1.1));
    input.scrollTo(sec(1.8), px(0), px(150));
    input.keyDown(sec(2.4), "KeyN");
    input.keyUp(sec(2.6), "KeyN");
    input.pointerMove(sec(3), px(12), px(12));
    input.pointerLeave(sec(3.4));
  }).build();
}

/** Times chosen to straddle every semantic transition in the trace. */
const PROBES = [0, 0.4, 0.5, 0.9, 1, 1.1, 1.5, 1.8, 2, 2.4, 2.6, 3, 3.4, 4] as const;

const canonicalScene = (objects: readonly EvaluatedLike[]): string =>
  JSON.stringify(
    objects.map((item) => ({
      id: item.object.id,
      matrix: item.matrix.map((value) => Number(value.toFixed(9))),
      opacity: Number(item.opacity.toFixed(9)),
      depth: item.depth,
    })),
  );

describe("browser bundle conforms to the Node runtime", () => {
  it("produces identical evaluated scenes and state at every semantic transition", () => {
    const value = project();
    const input = trace();
    const node = new ExperienceSession(value, input);
    // Round-trip through JSON exactly as the preview page embeds and revives the IR.
    const browserExperience = bundle.reviveExperience(JSON.parse(JSON.stringify(value)));
    const browserScenario = bundle.reviveScenario(JSON.parse(JSON.stringify(input)));
    const browser = new bundle.ExperienceSession(browserExperience, browserScenario);

    for (const time of PROBES) {
      expect(canonicalScene(browser.evaluateAt(time))).toBe(canonicalScene(node.evaluateAt(time)));
      expect(JSON.stringify(browser.replayTo(time).state)).toBe(
        JSON.stringify(node.replayTo(time).state),
      );
    }
  });

  it("renders identical SVG from the same evaluated scene", async () => {
    const value = project();
    const input = trace();
    const node = new ExperienceSession(value, input);
    const { renderSvg } = await import("@eac/renderer-svg");
    const browserExperience = bundle.reviveExperience(JSON.parse(JSON.stringify(value)));
    const browserScenario = bundle.reviveScenario(JSON.parse(JSON.stringify(input)));
    const browser = new bundle.ExperienceSession(browserExperience, browserScenario);

    for (const time of PROBES) {
      const overrides = (
        browser as unknown as { overridesAt: (time: number) => unknown }
      ).overridesAt(time);
      expect(bundle.renderSvg(browserExperience, time, overrides)).toBe(
        renderSvg(value, time, node.overridesAt(time)),
      );
    }
  });

  it("keeps the live update loop responsive", () => {
    const value = project();
    const browserExperience = bundle.reviveExperience(JSON.parse(JSON.stringify(value)));
    const live = new (
      bundle as unknown as {
        LiveSession: new (
          experience: unknown,
          options: unknown,
        ) => {
          lastFrame: number;
          fps: number;
          queue: (payload: unknown) => void;
          advanceTo: (frame: number) => void;
          overrides: () => unknown;
        };
      }
    ).LiveSession(browserExperience, {});
    const move = (bundle as unknown as { pointerMove: (point: unknown) => unknown }).pointerMove;

    // Sentinel, not a benchmark: it catches a pathological bundling or runtime regression, and is
    // loose enough not to track machine speed.
    const started = performance.now();
    for (let frame = 0; frame <= live.lastFrame; frame += 1) {
      if (frame % 4 === 0) live.queue(move({ x: 100 + ((frame * 7) % 250), y: 150 }));
      live.advanceTo(frame);
      bundle.renderSvg(browserExperience, frame / live.fps, live.overrides());
    }
    const elapsed = performance.now() - started;

    expect(live.lastFrame).toBeGreaterThan(30);
    expect(elapsed).toBeLessThan(4_000);
  });

  it("bundles only the pure lowering path, never the Node render pipeline", async () => {
    const source = await previewRuntimeBundle();

    for (const banned of ["child_process", "worker_threads", "resvg", "ffmpeg", "node:fs"])
      expect(source).not.toContain(banned);
  });
});
