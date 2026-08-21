import type { PathTrajectory, PropertyValue, Scale2, TransformNodeIR, Vec2 } from "@eac/ir";
import { sec, type Angle, type Depth, type Opacity, type Time } from "@eac/units";
import type { MotionOptions } from "./motion-normalizer.js";
import {
  TransformBuilder,
  type FollowPathOptions,
  type MoveOptions,
  type ScaleInput,
} from "./transform-builder.js";

type Target = TransformBuilder<TransformNodeIR>;
type PlanOptions<T extends PropertyValue> = Omit<MotionOptions<T>, "at">;

type PlannedOperation = Readonly<{
  offset: Time;
  apply: (at: Time) => void;
}>;

export type MotionPlan = Readonly<{
  duration: Time;
  operations: readonly PlannedOperation[];
}>;

const assertDuration = (name: string, duration: Time, allowZero = false): void => {
  if (duration.value < 0 || (!allowZero && duration.value === 0))
    throw new RangeError(`${name} duration must be ${allowZero ? "non-negative" : "positive"}`);
};

const freezePlan = (duration: Time, operations: readonly PlannedOperation[]): MotionPlan =>
  Object.freeze({ duration, operations: Object.freeze([...operations]) });

const atomic = (duration: Time, apply: PlannedOperation["apply"]): MotionPlan => {
  assertDuration("motion", duration);
  return freezePlan(duration, [Object.freeze({ offset: sec(0), apply })]);
};

export const motion = Object.freeze({
  moveTo(target: Target, value: Vec2, options: Omit<MoveOptions, "at">): MotionPlan {
    return atomic(options.duration, (at) => target.moveTo(value, { ...options, at }));
  },
  moveBy(target: Target, value: Vec2, options: Omit<FollowPathOptions, "at">): MotionPlan {
    return atomic(options.duration, (at) => target.moveBy(value, { ...options, at }));
  },
  followPath(
    target: Target,
    path: PathTrajectory,
    options: Omit<FollowPathOptions, "at">,
  ): MotionPlan {
    return atomic(options.duration, (at) => target.followPath(path, { ...options, at }));
  },
  rotateTo(target: Target, value: Angle, options: PlanOptions<Angle>): MotionPlan {
    return atomic(options.duration, (at) => target.rotateTo(value, { ...options, at }));
  },
  rotateBy(target: Target, value: Angle, options: Omit<FollowPathOptions, "at">): MotionPlan {
    return atomic(options.duration, (at) => target.rotateBy(value, { ...options, at }));
  },
  scaleTo(target: Target, value: ScaleInput, options: PlanOptions<Scale2>): MotionPlan {
    return atomic(options.duration, (at) => target.scaleTo(value, { ...options, at }));
  },
  scaleBy(target: Target, value: ScaleInput, options: Omit<FollowPathOptions, "at">): MotionPlan {
    return atomic(options.duration, (at) => target.scaleBy(value, { ...options, at }));
  },
  fadeTo(target: Target, value: Opacity, options: PlanOptions<Opacity>): MotionPlan {
    return atomic(options.duration, (at) => target.fadeTo(value, { ...options, at }));
  },
  depthTo(target: Target, value: Depth, options: PlanOptions<Depth>): MotionPlan {
    return atomic(options.duration, (at) => target.depthTo(value, { ...options, at }));
  },
  depthBy(target: Target, value: Depth, options: Omit<FollowPathOptions, "at">): MotionPlan {
    return atomic(options.duration, (at) => target.depthBy(value, { ...options, at }));
  },
});

const shifted = (plan: MotionPlan, offset: Time): readonly PlannedOperation[] =>
  plan.operations.map((operation) =>
    Object.freeze({ ...operation, offset: sec(operation.offset.value + offset.value) }),
  );

export function sequence(...plans: readonly MotionPlan[]): MotionPlan {
  let elapsed = 0;
  const operations: PlannedOperation[] = [];
  for (const plan of plans) {
    operations.push(...shifted(plan, sec(elapsed)));
    elapsed += plan.duration.value;
  }
  return freezePlan(sec(elapsed), operations);
}

export function parallel(...plans: readonly MotionPlan[]): MotionPlan {
  return freezePlan(
    sec(Math.max(0, ...plans.map((plan) => plan.duration.value))),
    plans.flatMap((plan) => plan.operations),
  );
}

export function delay(duration: Time, plan?: MotionPlan): MotionPlan {
  assertDuration("delay", duration, true);
  if (plan === undefined) return freezePlan(duration, []);
  return freezePlan(sec(duration.value + plan.duration.value), shifted(plan, duration));
}

export function stagger<T>(
  items: readonly T[],
  interval: Time,
  create: (item: T, index: number) => MotionPlan,
): MotionPlan {
  assertDuration("stagger interval", interval, true);
  return parallel(
    ...items.map((item, index) => delay(sec(interval.value * index), create(item, index))),
  );
}

export function schedule(plan: MotionPlan, options: Readonly<{ at?: Time }> = {}): void {
  const start = options.at ?? sec(0);
  for (const operation of plan.operations)
    operation.apply(sec(start.value + operation.offset.value));
}
