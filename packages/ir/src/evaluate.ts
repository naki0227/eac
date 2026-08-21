import { deg, depth, lerpUnit, opacity, px, type UnitValue } from "@eac/units";
import { applyEasing } from "./easing.js";
import type {
  MotionSegment,
  PropertyValue,
  Scale2,
  TimedProperty,
  Trajectory,
  Vec2,
} from "./types.js";

function isVec2(value: PropertyValue): value is Vec2 {
  return "x" in value && typeof value.x === "object";
}

const isScale = (value: PropertyValue): value is Scale2 =>
  "kind" in value && value.kind === "scale";

function interpolateTrajectory(from: Vec2, to: Vec2, progress: number, path: Trajectory): Vec2 {
  if (path.kind === "linear") {
    return { x: lerpUnit(from.x, to.x, progress), y: lerpUnit(from.y, to.y, progress) };
  }
  if (path.kind === "bezier") {
    const p = progress;
    const q = 1 - p;
    const cubic = (a: number, b: number, c: number, d: number): number =>
      q ** 3 * a + 3 * q ** 2 * p * b + 3 * q * p ** 2 * c + p ** 3 * d;
    return {
      x: px(cubic(from.x.value, path.control1.x.value, path.control2.x.value, to.x.value)),
      y: px(cubic(from.y.value, path.control1.y.value, path.control2.y.value, to.y.value)),
    };
  }
  const theta = progress * Math.PI * 2 * (path.turns ?? 1);
  const normalizedX =
    theta === 0 ? 0 : (theta - Math.sin(theta)) / (Math.PI * 2 * (path.turns ?? 1));
  const bump = path.radius.value * (1 - Math.cos(theta));
  return {
    x: px(from.x.value + (to.x.value - from.x.value) * normalizedX),
    y: px(from.y.value + (to.y.value - from.y.value) * progress - bump),
  };
}

function interpolate<T extends PropertyValue>(
  from: T,
  to: T,
  progress: number,
  segment: MotionSegment<T>,
): T {
  if (isVec2(from) && isVec2(to)) {
    return interpolateTrajectory(from, to, progress, segment.trajectory ?? { kind: "linear" }) as T;
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
