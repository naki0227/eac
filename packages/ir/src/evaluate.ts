import { deg, depth, lerpUnit, opacity, type UnitValue } from "@eac/units";
import { applyEasing } from "./easing.js";
import { evaluateMoveTrajectory, evaluatePathTrajectory, isPathTrajectory } from "./trajectory.js";
import type {
  ColorIR,
  MotionSegment,
  PropertyValue,
  Scale2,
  TimedProperty,
  Vec2,
} from "./types.js";

function isVec2(value: PropertyValue): value is Vec2 {
  return "x" in value && typeof value.x === "object";
}

const isScale = (value: PropertyValue): value is Scale2 =>
  "kind" in value && value.kind === "scale";

const isColor = (value: PropertyValue): value is ColorIR =>
  "kind" in value && value.kind === "color";

function interpolate<T extends PropertyValue>(
  from: T,
  to: T,
  progress: number,
  segment: MotionSegment<T>,
): T {
  if (isVec2(from) && isVec2(to)) {
    const path = segment.trajectory ?? { kind: "linear" };
    return (
      isPathTrajectory(path)
        ? evaluatePathTrajectory(path, progress)
        : evaluateMoveTrajectory(path, from, to, progress)
    ) as T;
  }
  if (isScale(from) && isScale(to))
    return {
      kind: "scale",
      x: from.x + (to.x - from.x) * progress,
      y: from.y + (to.y - from.y) * progress,
    } as T;
  if (isColor(from) && isColor(to))
    return {
      kind: "color",
      red: from.red + (to.red - from.red) * progress,
      green: from.green + (to.green - from.green) * progress,
      blue: from.blue + (to.blue - from.blue) * progress,
      alpha: from.alpha + (to.alpha - from.alpha) * progress,
    } as T;
  return lerpUnit(from as UnitValue<"angle">, to as UnitValue<"angle">, progress) as T;
}

const isTimeOrdered = <T extends PropertyValue>(segments: readonly MotionSegment<T>[]): boolean =>
  segments.every(
    (segment, index) =>
      index === 0 || (segments[index - 1]?.start.value ?? 0) <= segment.start.value,
  );

/**
 * Segments produced by `build()` are already time-ordered, so normalized IR is never re-sorted
 * per frame. Hand-authored IR is sorted once here as a fallback.
 */
const orderedSegments = <T extends PropertyValue>(
  segments: readonly MotionSegment<T>[],
): readonly MotionSegment<T>[] =>
  isTimeOrdered(segments) ? segments : [...segments].sort((a, b) => a.start.value - b.start.value);

export function evaluateTimedProperty<T extends PropertyValue>(
  property: TimedProperty<T>,
  time: number,
): T {
  let current = property.initial;
  for (const segment of orderedSegments(property.segments)) {
    if (time < segment.start.value) break;
    const from = segment.from ?? current;
    const end = segment.start.value + segment.duration.value;
    if (time <= end) {
      // A non-positive duration is rejected by the checker; evaluation still steps to the target
      // instantly so no consumer can observe a NaN progress value.
      const progress =
        segment.duration.value > 0
          ? Math.max(0, Math.min(1, (time - segment.start.value) / segment.duration.value))
          : 1;
      return interpolate(
        from,
        segment.target,
        applyEasing(segment.easing ?? { kind: "linear" }, progress),
        segment,
      );
    }
    current = segment.target;
  }
  return current;
}

export const defaultProperties = (position: Vec2) => ({
  position: { kind: "timed" as const, initial: position, segments: [] },
  rotation: { kind: "timed" as const, initial: deg(0), segments: [] },
  scale: {
    kind: "timed" as const,
    initial: { kind: "scale" as const, x: 1, y: 1 },
    segments: [],
  },
  opacity: { kind: "timed" as const, initial: opacity(1), segments: [] },
  depth: { kind: "timed" as const, initial: depth(0), segments: [] },
});
