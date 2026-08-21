import {
  evaluateTimedProperty,
  type Easing,
  type MotionSegment,
  type PropertyMap,
  type PropertyName,
  type PropertyValue,
  type Scale2,
  type TimedProperty,
  type Trajectory,
  type Vec2,
} from "@eac/ir";
import { deg, depth, px, type Angle, type Depth, type Time } from "@eac/units";

export type MotionOptions<T extends PropertyValue> = Readonly<{
  at: Time;
  duration: Time;
  from?: T;
  easing?: Easing;
}>;

export type RelativeMotionOptions = Readonly<{
  at: Time;
  duration: Time;
  easing?: Easing;
}>;

export type MotionOperation<T extends PropertyValue> = Readonly<{
  id: string;
  ordinal: number;
  mode: "absolute" | "relative";
  value: T;
  options: MotionOptions<T>;
  trajectory?: Trajectory;
}>;

export type MotionOperationMap = {
  [K in PropertyName]: MotionOperation<PropertyMap[K]["initial"]>[];
};

export const createMotionOperationMap = (): MotionOperationMap => ({
  position: [],
  rotation: [],
  scale: [],
  opacity: [],
  depth: [],
});

function relativeTarget(
  name: PropertyName,
  current: PropertyValue,
  delta: PropertyValue,
): PropertyValue {
  if (name === "position") {
    const from = current as Vec2;
    const offset = delta as Vec2;
    return { x: px(from.x.value + offset.x.value), y: px(from.y.value + offset.y.value) };
  }
  if (name === "rotation") return deg((current as Angle).value + (delta as Angle).value);
  if (name === "depth") return depth((current as Depth).value + (delta as Depth).value);
  if (name === "scale") {
    const from = current as Scale2;
    const offset = delta as Scale2;
    return { kind: "scale", x: from.x + offset.x, y: from.y + offset.y };
  }
  throw new TypeError(`Relative ${name} motion is not supported.`);
}

function normalizeProperty<T extends PropertyValue>(
  name: PropertyName | undefined,
  property: TimedProperty<T>,
  operations: readonly MotionOperation<T>[],
): TimedProperty<T> {
  const segments: MotionSegment<T>[] = [];
  const ordered = [...operations].sort(
    (left, right) => left.options.at.value - right.options.at.value || left.ordinal - right.ordinal,
  );
  for (const operation of ordered) {
    const current = evaluateTimedProperty({ ...property, segments }, operation.options.at.value);
    let target: T;
    if (operation.mode === "relative") {
      if (name === undefined) throw new TypeError("Relative style motion is not supported.");
      target = relativeTarget(name, current, operation.value) as T;
    } else target = operation.value;
    segments.push({
      id: operation.id,
      start: operation.options.at,
      duration: operation.options.duration,
      target,
      ...(operation.options.from === undefined ? {} : { from: operation.options.from }),
      ...(operation.options.easing === undefined ? {} : { easing: operation.options.easing }),
      ...(operation.trajectory === undefined ? {} : { trajectory: operation.trajectory }),
    } as MotionSegment<T>);
  }
  return { ...property, segments };
}

export function normalizeAbsoluteProperty<T extends PropertyValue>(
  property: TimedProperty<T>,
  operations: readonly MotionOperation<T>[],
): TimedProperty<T> {
  return normalizeProperty(undefined, property, operations);
}

export function normalizeProperties(
  base: PropertyMap,
  operations: MotionOperationMap,
): PropertyMap {
  return {
    position: normalizeProperty("position", base.position, operations.position),
    rotation: normalizeProperty("rotation", base.rotation, operations.rotation),
    scale: normalizeProperty("scale", base.scale, operations.scale),
    opacity: normalizeProperty("opacity", base.opacity, operations.opacity),
    depth: normalizeProperty("depth", base.depth, operations.depth),
  };
}
