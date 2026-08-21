import { deg, opacity, px } from "@eac/units";
import { describe, expect, it } from "vitest";
import { evaluateScene, hitTest, type SceneIR } from "./index.js";
import { sec } from "@eac/units";
import { defaultProperties } from "./evaluate.js";
import type { AppearanceIR, GeometryIR, NodeIR, ObjectIR } from "./types.js";

const white = { kind: "color", red: 1, green: 1, blue: 1, alpha: 1 } as const;
const appearance: AppearanceIR = {
  fill: { kind: "timed", initial: white, segments: [] },
  stroke: { kind: "timed", initial: white, segments: [] },
  blur: { kind: "timed", initial: px(0), segments: [] },
  strokeWidth: px(1),
};

function object(id: string, geometry: GeometryIR, overrides: Partial<ObjectIR> = {}): ObjectIR {
  return {
    kind: "object",
    id,
    geometry,
    appearance,
    properties: defaultProperties({ x: px(0), y: px(0) }),
    dependencies: [],
    unsupportedProperties: [],
    sourceOrder: 0,
    interactive: true,
    ...overrides,
  };
}

const scene = (nodes: readonly NodeIR[]): SceneIR => ({
  id: "main",
  start: sec(0),
  duration: sec(1),
  nodes,
  audioClips: [],
  reactive: { states: [], bindings: [], rules: [], sounds: [] },
});

const at = (nodes: readonly NodeIR[], x: number, y: number): string | undefined =>
  hitTest(evaluateScene(scene(nodes), 0), x, y);

const rect = (width: number, height: number): GeometryIR => ({
  kind: "rect",
  width: px(width),
  height: px(height),
  cornerRadius: px(0),
});

describe("hit testing", () => {
  it("respects translation, rotation, and scale through the world transform", () => {
    const properties = defaultProperties({ x: px(100), y: px(100) });
    const rotated = object("rotated", rect(100, 20), {
      properties: {
        ...properties,
        rotation: { kind: "timed", initial: deg(90), segments: [] },
      },
    });

    // The 100×20 bar is rotated a quarter turn, so it is now tall and narrow.
    expect(at([rotated], 100, 140)).toBe("rotated");
    expect(at([rotated], 140, 100)).toBeUndefined();
  });

  it("scales the hit area with the node", () => {
    const properties = defaultProperties({ x: px(100), y: px(100) });
    const scaled = object("scaled", rect(40, 40), {
      properties: {
        ...properties,
        scale: { kind: "timed", initial: { kind: "scale", x: 3, y: 3 }, segments: [] },
      },
    });

    expect(at([scaled], 150, 100)).toBe("scaled");
    expect(at([scaled], 170, 100)).toBeUndefined();
  });

  it("composes a group transform with the child transform", () => {
    const child = object("child", rect(20, 20), {
      properties: defaultProperties({ x: px(50), y: px(0) }),
    });
    const group: NodeIR = {
      kind: "group",
      id: "group",
      properties: {
        ...defaultProperties({ x: px(200), y: px(100) }),
        rotation: { kind: "timed", initial: deg(90), segments: [] },
      },
      dependencies: [],
      unsupportedProperties: [],
      sourceOrder: 0,
      children: [child],
    };

    expect(at([group], 200, 150)).toBe("child");
    expect(at([group], 250, 100)).toBeUndefined();
  });

  it("returns the frontmost node by depth, then declaration order", () => {
    const behind = object("behind", rect(80, 80), {
      properties: {
        ...defaultProperties({ x: px(50), y: px(50) }),
        depth: { kind: "timed", initial: { kind: "depth", value: 10 }, segments: [] },
      },
      sourceOrder: 0,
    });
    const front = object("front", rect(80, 80), {
      properties: {
        ...defaultProperties({ x: px(50), y: px(50) }),
        depth: { kind: "timed", initial: { kind: "depth", value: 20 }, segments: [] },
      },
      sourceOrder: 1,
    });

    expect(at([behind, front], 50, 50)).toBe("front");

    const first = object("first", rect(80, 80), {
      properties: defaultProperties({ x: px(50), y: px(50) }),
      sourceOrder: 0,
    });
    const second = object("second", rect(80, 80), {
      properties: defaultProperties({ x: px(50), y: px(50) }),
      sourceOrder: 1,
    });

    expect(at([first, second], 50, 50)).toBe("second");
  });

  it("skips fully transparent and non-interactive nodes", () => {
    const invisible = object("invisible", rect(80, 80), {
      properties: {
        ...defaultProperties({ x: px(50), y: px(50) }),
        opacity: { kind: "timed", initial: opacity(0), segments: [] },
      },
    });
    const decorative = object("decorative", rect(80, 80), {
      properties: defaultProperties({ x: px(50), y: px(50) }),
      interactive: false,
    });

    expect(at([invisible], 50, 50)).toBeUndefined();
    expect(at([decorative], 50, 50)).toBeUndefined();
  });

  it("uses the circle radius and the deterministic text box", () => {
    const dot = object(
      "dot",
      { kind: "circle", radius: px(20) },
      {
        properties: defaultProperties({ x: px(100), y: px(100) }),
      },
    );
    const label = object(
      "label",
      {
        kind: "text",
        text: "abc",
        fontSize: px(20),
        fontFamily: "sans-serif",
        fontWeight: 400,
        textAlign: "start",
        letterSpacing: px(0),
      },
      { properties: defaultProperties({ x: px(0), y: px(50) }) },
    );

    expect(at([dot], 115, 100)).toBe("dot");
    expect(at([dot], 100 + 21, 100)).toBeUndefined();
    // "abc" at 20px advances 3 × 12 = 36px to the right of the origin, one line-height up.
    expect(at([label], 30, 40)).toBe("label");
    expect(at([label], 40, 40)).toBeUndefined();
  });

  it("never hits on a non-finite pointer position", () => {
    const box = object("box", rect(80, 80), {
      properties: defaultProperties({ x: px(50), y: px(50) }),
    });

    expect(at([box], Number.NaN, 50)).toBeUndefined();
  });
});
