import { deg, depth, lerpUnit, opacity, type UnitValue } from "@eac/units";
import { applyEasing } from "./easing.js";
import { evaluateMoveTrajectory, evaluatePathTrajectory, isPathTrajectory } from "./trajectory.js";
import type { MotionSegment, PropertyValue, Scale2, TimedProperty, Vec2 } from "./types.js";

function isVec2(value: PropertyValue): value is Vec2 {
  return "x" in value && typeof value.x === "object";
}

const isScale = (value: PropertyValue): value is Scale2 =>
  "kind" in value && value.kind === "scale";

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
  return lerpUnit(from as UnitValue<"angle">, to as UnitValue<"angle">, progress) as T;
}

export function evaluateTimedProperty<T extends PropertyValue>(
  property: TimedProperty<T>,
  time: number,
): T {
  let current = property.initial;
  const segments = [...property.segments].sort((a, b) => a.start.value - b.start.value);
  for (const segment of segments) {
    if (time < segment.start.value) break;
    const from = segment.from ?? current;
    const end = segment.start.value + segment.duration.value;
    if (time <= end) {
      const progress = Math.max(
        0,
        Math.min(1, (time - segment.start.value) / segment.duration.value),
      );
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
