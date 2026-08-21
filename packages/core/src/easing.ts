import type { Easing } from "@eac/ir";

const named = <K extends Exclude<Easing["kind"], "cubic-bezier">>(kind: K) =>
  Object.freeze({ kind }) as Readonly<{ kind: K }>;

export const easing = Object.freeze({
  linear: named("linear"),
  easeIn: named("ease-in"),
  easeOut: named("ease-out"),
  easeInOut: named("ease-in-out"),
  cubicBezier(x1: number, y1: number, x2: number, y2: number): Easing {
    if (![x1, y1, x2, y2].every(Number.isFinite))
      throw new RangeError("cubicBezier coordinates must be finite");
    if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1)
      throw new RangeError("cubicBezier x coordinates must be between 0 and 1");
    return Object.freeze({ kind: "cubic-bezier", x1, y1, x2, y2 });
  },
});
