import {
  evaluatePathTrajectory,
  type AppearanceIR,
  type GeometryIR,
  type MoveTrajectory,
  type ObjectIR,
  type PathTrajectory,
  type PropertyMap,
  type PropertyName,
  type Scale2,
  type Trajectory,
  type UnsupportedProperty,
  type Vec2,
} from "@eac/ir";
import type { Angle, Depth, Opacity, Time } from "@eac/units";
import {
  createMotionOperationMap,
  normalizeProperties,
  type MotionOperation,
  type MotionOptions,
  type RelativeMotionOptions,
} from "./motion-normalizer.js";

type MutableObject = { -readonly [K in keyof ObjectIR]: ObjectIR[K] };
export type MoveOptions = MotionOptions<Vec2> & Readonly<{ trajectory?: MoveTrajectory }>;
export type FollowPathOptions = RelativeMotionOptions;
export type ScaleInput = number | Readonly<{ x: number; y: number }>;

const scaleValue = (value: ScaleInput): Scale2 =>
  typeof value === "number"
    ? { kind: "scale", x: value, y: value }
    : { kind: "scale", x: value.x, y: value.y };

export class ObjectBuilder {
  readonly #object: MutableObject;
  readonly #baseProperties: PropertyMap;
  readonly #operations = createMotionOperationMap();
  #motionCount = 0;

  constructor(
    id: string,
    geometry: GeometryIR,
    appearance: AppearanceIR,
    properties: PropertyMap,
    sourceOrder: number,
  ) {
    this.#baseProperties = properties;
    this.#object = {
      id,
      geometry,
      appearance,
      properties,
      dependencies: [],
      unsupportedProperties: [],
      sourceOrder,
    };
  }

  get ir(): ObjectIR {
    return this.#object;
  }

  #addMotion<K extends PropertyName>(
    name: K,
    value: PropertyMap[K]["initial"],
    options: MotionOptions<PropertyMap[K]["initial"]>,
    trajectory?: Trajectory,
    mode: MotionOperation<PropertyMap[K]["initial"]>["mode"] = "absolute",
  ): this {
    const operation: MotionOperation<PropertyMap[K]["initial"]> = {
      id: `${this.#object.id}.${name}.${++this.#motionCount}`,
      ordinal: this.#motionCount,
      mode,
      value,
      options,
      ...(trajectory === undefined ? {} : { trajectory }),
    };
    const operations = this.#operations[name] as MotionOperation<PropertyMap[K]["initial"]>[];
    operations.push(operation);
    this.#object.properties = normalizeProperties(this.#baseProperties, this.#operations);
    return this;
  }

  moveTo(target: Vec2, options: MoveOptions): this {
    return this.#addMotion("position", target, options, options.trajectory);
  }

  moveBy(delta: Vec2, options: RelativeMotionOptions): this {
    return this.#addMotion("position", delta, options, undefined, "relative");
  }

  followPath(path: PathTrajectory, options: FollowPathOptions): this {
    return this.#addMotion("position", evaluatePathTrajectory(path, 1), options, path);
  }

  rotateTo(target: Angle, options: MotionOptions<Angle>): this {
    return this.#addMotion("rotation", target, options);
  }

  rotateBy(delta: Angle, options: RelativeMotionOptions): this {
    return this.#addMotion("rotation", delta, options, undefined, "relative");
  }

  scaleTo(target: ScaleInput, options: MotionOptions<Scale2>): this {
    return this.#addMotion("scale", scaleValue(target), options);
  }

  scaleBy(delta: ScaleInput, options: RelativeMotionOptions): this {
    return this.#addMotion("scale", scaleValue(delta), options, undefined, "relative");
  }

  fadeTo(target: Opacity, options: MotionOptions<Opacity>): this {
    return this.#addMotion("opacity", target, options);
  }

  depthTo(target: Depth, options: MotionOptions<Depth>): this {
    return this.#addMotion("depth", target, options);
  }

  depthBy(delta: Depth, options: RelativeMotionOptions): this {
    return this.#addMotion("depth", delta, options, undefined, "relative");
  }

  bringForward(options: Readonly<{ at: Time; duration: Time; to: Depth }>): this {
    return this.depthTo(options.to, options);
  }

  dependsOn(object: ObjectBuilder, property: PropertyName = "position"): this {
    this.#object.dependencies = [...this.#object.dependencies, `${object.ir.id}.${property}`];
    return this;
  }

  unsupported(kind: UnsupportedProperty["kind"], name: string): this {
    this.#object.unsupportedProperties = [...this.#object.unsupportedProperties, { kind, name }];
    return this;
  }
}
