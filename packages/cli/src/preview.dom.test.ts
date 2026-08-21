import { experience, hover, onClick, opacity, px, sec, toggle, when } from "@eac/core";
import type { ExperienceIR } from "@eac/ir";
import { ExperienceSession } from "@eac/runtime";
import { createContext, runInContext } from "node:vm";
import { Window } from "happy-dom";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { previewDocument, previewRuntimeBundle } from "./preview.js";

type PreviewHandle = Readonly<{
  live: { lastFrame: number; fps: number; frame: number };
  send: (payload: unknown) => void;
  commit: (frame: number) => void;
  seek: (frame: number) => void;
  draw: () => void;
  scenario: () => unknown;
  mode: () => string;
  state: () => {
    hoverTarget?: string;
    pressedTarget?: string;
    states: Record<string, unknown>;
    scroll: { x: number; y: number };
    keys: readonly string[];
  };
}>;

const CANVAS = { width: 400, height: 300 };

function project(): ExperienceIR {
  const value = experience({
    name: "dom-preview",
    width: px(CANVAS.width),
    height: px(CANVAS.height),
    duration: sec(3),
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
  scene.bind(card, { scale: when(hover(card), 1.25, 1) });
  scene.bind(panel, { opacity: when(open.value, 1, 0) });
  scene.on(onClick(card), toggle(open));
  return value.build();
}

let runtime = "";
beforeAll(async () => {
  runtime = await previewRuntimeBundle();
});

let dom: Window | undefined;
afterEach(async () => {
  await dom?.happyDOM.close();
  dom = undefined;
});

const document_ = (): Document => dom?.document as unknown as Document;

/**
 * Loads the generated preview and executes its scripts the way a browser does: each inline script
 * runs in turn against one shared global that *is* the window, so the bundle's global and the
 * driver's DOM lookups behave exactly as they do on a page.
 *
 * happy-dom supplies the real DOM and event dispatch; `node:vm` supplies the script global. Together
 * they exercise the shipped bundle rather than a re-implementation of it. A headless browser was
 * assessed and rejected: Playwright downloads browser binaries on install, which is a large cost for
 * a check this already covers.
 *
 * happy-dom performs no layout, so the stage rect is stubbed to the canvas size. That makes the
 * coordinate conversion an identity here; the conversion itself is unit-tested separately.
 */
function mountPreview(html: string): PreviewHandle {
  dom = new Window({ url: "https://eac.test/preview" });
  dom.document.write(html);
  const stage = dom.document.querySelector("#stage");
  if (stage === null) throw new Error("preview stage missing");
  Object.defineProperty(stage, "getBoundingClientRect", {
    value: () => ({
      left: 0,
      top: 0,
      width: CANVAS.width,
      height: CANVAS.height,
      right: CANVAS.width,
      bottom: CANVAS.height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
    configurable: true,
  });

  const scope = dom.window as unknown as Record<string, unknown>;
  scope.window = scope;
  scope.globalThis = scope;
  const context = createContext(scope);
  for (const script of dom.document.querySelectorAll("script"))
    runInContext(script.textContent, context, { filename: "preview.js" });

  const handle = scope.__eacPreview as PreviewHandle | undefined;
  if (handle === undefined) throw new Error("preview runtime did not initialize");
  handle.draw();
  return handle;
}

const svg = (): string => document_().querySelector("#stage")?.innerHTML ?? "";
const cardMatrix = (): string => {
  const match = /<g id="card" transform="matrix\(([^)]*)\)"/.exec(svg());
  return match?.[1] ?? "";
};
const panelOpacity = (): string => {
  const match = /<g id="panel"[^>]*opacity="([^"]*)"/.exec(svg());
  return match?.[1] ?? "";
};

function pointerEvent(type: string, init: Record<string, unknown> = {}): void {
  const target = dom?.document.querySelector("#stage");
  const EventCtor = (dom?.window as unknown as { MouseEvent: new (t: string, i: unknown) => Event })
    .MouseEvent;
  target?.dispatchEvent(new EventCtor(type, { bubbles: true, ...init }) as never);
}

function pointerAt(handle: PreviewHandle, x: number, y: number, frame: number): void {
  pointerEvent("pointermove", { clientX: x, clientY: y });
  handle.commit(frame);
}

describe("browser preview drives the shared runtime live", () => {
  it("changes the rendered SVG when the pointer enters a bound node", () => {
    const handle = mountPreview(previewDocument(project(), runtime));

    expect(handle.mode()).toBe("live");
    const idle = cardMatrix();
    expect(idle).not.toBe("");

    pointerAt(handle, 200, 150, 5);

    expect(handle.state().hoverTarget).toBe("card");
    expect(cardMatrix()).not.toBe(idle);
    expect(cardMatrix().startsWith("1.25")).toBe(true);

    pointerAt(handle, 10, 10, 8);

    expect(handle.state().hoverTarget).toBeUndefined();
    expect(cardMatrix()).toBe(idle);
  });

  it("derives click from real DOM down and up events", () => {
    const handle = mountPreview(previewDocument(project(), runtime));

    pointerAt(handle, 200, 150, 3);
    expect(panelOpacity()).toBe("0");

    pointerEvent("pointerdown", { clientX: 200, clientY: 150 });
    handle.commit(4);
    expect(handle.state().pressedTarget).toBe("card");
    expect(handle.state().states.open).toBe(false);

    pointerEvent("pointerup");
    handle.commit(5);

    expect(handle.state().states.open).toBe(true);
    expect(panelOpacity()).toBe("1");
  });

  it("does not click when the pointer leaves the target between down and up", () => {
    const handle = mountPreview(previewDocument(project(), runtime));

    pointerAt(handle, 200, 150, 2);
    pointerEvent("pointerdown", { clientX: 200, clientY: 150 });
    handle.commit(3);
    pointerAt(handle, 10, 10, 4);
    pointerEvent("pointerup");
    handle.commit(5);

    expect(handle.state().states.open).toBe(false);
  });

  it("records the live interaction and replays it to the same result", () => {
    const value = project();
    const handle = mountPreview(previewDocument(value, runtime));

    pointerAt(handle, 200, 150, 4);
    pointerEvent("pointerdown", { clientX: 200, clientY: 150 });
    handle.commit(6);
    pointerEvent("pointerup");
    handle.commit(7);
    pointerAt(handle, 12, 12, 12);
    handle.commit(handle.live.lastFrame);

    const liveState = JSON.stringify(handle.state());
    const recorded = handle.scenario() as ConstructorParameters<typeof ExperienceSession>[1];

    // A fresh Node session, given only the exported scenario, must agree.
    const replay = new ExperienceSession(value, recorded);
    const finalTime = handle.live.lastFrame / handle.live.fps;

    expect(JSON.stringify(replay.replayTo(finalTime).state)).toBe(liveState);
    expect(replay.replayTo(finalTime).state.states.open).toBe(true);
  });

  it("keeps the runtime free of eval and remote dependencies", () => {
    const html = previewDocument(project(), runtime);

    expect(runtime).not.toContain("eval(");
    expect(runtime).not.toContain("new Function");
    expect(runtime).not.toContain("fetch(");
    expect(runtime).not.toContain("XMLHttpRequest");
    expect(runtime).not.toContain("import(");
    // No external script, style, or asset: the page works with no network at all.
    expect(html).not.toMatch(/<script[^>]+src=/);
    expect(html).not.toMatch(/<link[^>]+href=/);
    expect(html).not.toMatch(/(src|href)="https?:/);
  });

  it("escapes IR content so it cannot break out of the data script", () => {
    const value = experience({
      name: "</script><script>window.__pwned=1</script>",
      width: px(200),
      height: px(200),
      duration: sec(1),
      fps: 10,
    });
    value.scene("main").text("label", '</script> \u2028 \u2029 "quotes" & <b>', {
      position: { x: px(100), y: px(100) },
      fontSize: px(12),
      fill: "#ffffff",
    });
    const html = previewDocument(value.build(), runtime);

    expect(html).not.toContain("</script><script>window.__pwned");
    expect(html).toContain("\\u003c/script\\u003e");

    const handle = mountPreview(html);
    expect((dom?.window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
    expect(handle.mode()).toBe("live");
  });
});
