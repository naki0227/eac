import { describe, expect, it } from "vitest";
import { PointerCoalescer, isInsideCanvas, normalizeKey, toScenePoint } from "./browser.js";

const canvas = { width: 400, height: 200 };

describe("pointer coordinate conversion", () => {
  it("maps an exactly-fitting element one to one", () => {
    const rect = { left: 0, top: 0, width: 400, height: 200 };

    expect(toScenePoint(rect, canvas, 0, 0)).toEqual({ x: 0, y: 0 });
    expect(toScenePoint(rect, canvas, 400, 200)).toEqual({ x: 400, y: 200 });
    expect(toScenePoint(rect, canvas, 123, 45)).toEqual({ x: 123, y: 45 });
  });

  it("removes the element offset", () => {
    const rect = { left: 30, top: 70, width: 400, height: 200 };

    expect(toScenePoint(rect, canvas, 30, 70)).toEqual({ x: 0, y: 0 });
    expect(toScenePoint(rect, canvas, 230, 170)).toEqual({ x: 200, y: 100 });
  });

  it("undoes uniform CSS scaling", () => {
    const rect = { left: 0, top: 0, width: 800, height: 400 };

    expect(toScenePoint(rect, canvas, 800, 400)).toEqual({ x: 400, y: 200 });
    expect(toScenePoint(rect, canvas, 200, 100)).toEqual({ x: 100, y: 50 });
  });

  it("undoes letterboxing when the element aspect ratio differs", () => {
    // 400x200 scene inside a 400x400 box fits at scale 1 with 100px of vertical letterbox.
    const rect = { left: 0, top: 0, width: 400, height: 400 };

    expect(toScenePoint(rect, canvas, 0, 100)).toEqual({ x: 0, y: 0 });
    expect(toScenePoint(rect, canvas, 400, 300)).toEqual({ x: 400, y: 200 });
    expect(toScenePoint(rect, canvas, 200, 200)).toEqual({ x: 200, y: 100 });
  });

  it("undoes pillarboxing and scaling together", () => {
    // 400x200 scene inside 1000x200 fits at scale 1 with 300px of horizontal letterbox.
    const rect = { left: 0, top: 0, width: 1000, height: 200 };

    expect(toScenePoint(rect, canvas, 300, 0)).toEqual({ x: 0, y: 0 });
    expect(toScenePoint(rect, canvas, 700, 200)).toEqual({ x: 400, y: 200 });
  });

  it("refuses degenerate rectangles and non-finite input", () => {
    expect(toScenePoint({ left: 0, top: 0, width: 0, height: 200 }, canvas, 1, 1)).toBeUndefined();
    expect(toScenePoint({ left: 0, top: 0, width: 400, height: 0 }, canvas, 1, 1)).toBeUndefined();
    expect(
      toScenePoint({ left: 0, top: 0, width: 400, height: 200 }, { width: 0, height: 0 }, 1, 1),
    ).toBeUndefined();
    expect(
      toScenePoint({ left: 0, top: 0, width: 400, height: 200 }, canvas, Number.NaN, 1),
    ).toBeUndefined();
  });

  it("reports whether a converted point is inside the canvas", () => {
    expect(isInsideCanvas({ x: 0, y: 0 }, canvas)).toBe(true);
    expect(isInsideCanvas({ x: 400, y: 200 }, canvas)).toBe(true);
    expect(isInsideCanvas({ x: -1, y: 10 }, canvas)).toBe(false);
    expect(isInsideCanvas({ x: 10, y: 201 }, canvas)).toBe(false);
  });
});

describe("keyboard normalization", () => {
  it("prefers the layout-independent code", () => {
    expect(normalizeKey({ code: "KeyA", key: "a" })).toBe("KeyA");
    expect(normalizeKey({ key: "Escape" })).toBe("Escape");
    expect(normalizeKey({})).toBeUndefined();
    expect(normalizeKey({ code: "" })).toBeUndefined();
  });
});

describe("pointer coalescing", () => {
  it("drops sub-pixel movement and keeps meaningful movement", () => {
    const coalescer = new PointerCoalescer(1);

    expect(coalescer.accept({ x: 10, y: 10 })).toBe(true);
    expect(coalescer.accept({ x: 10.4, y: 10.4 })).toBe(false);
    expect(coalescer.accept({ x: 11.5, y: 10 })).toBe(true);
    coalescer.reset();
    expect(coalescer.accept({ x: 11.5, y: 10 })).toBe(true);
  });
});
