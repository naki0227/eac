import type {
  AppearanceIR,
  GeometryIR,
  MotionSegment,
  ObjectIR,
  PropertyMap,
  PropertyName,
  PropertyValue,
  Trajectory,
  UnsupportedProperty,
  Vec2,
} from "@eac/ir";
import type { Angle, Depth, Opacity, Time } from "@eac/units";

type MutableObject = { -readonly [K in keyof ObjectIR]: ObjectIR[K] };
type MotionOptions<T extends PropertyValue> = Readonly<{
  at: Time;
  duration: Time;
  from?: T;
}>;
export type MoveOptions = MotionOptions<Vec2> & Readonly<{ trajectory?: Trajectory }>;

export class ObjectBuilder {
  readonly #object: MutableObject;
  #motionCount = 0;

  constructor(
    id: string,
    geometry: GeometryIR,
    appearance: AppearanceIR,
    properties: PropertyMap,
    sourceOrder: number,
  ) {
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
    target: PropertyMap[K]["initial"],
    options: MotionOptions<PropertyMap[K]["initial"]>,
    trajectory?: Trajectory,
  ): this {
    const property = this.#object.properties[name];
    const segment = {
      id: `${this.#object.id}.${name}.${++this.#motionCount}`,
      start: options.at,
      duration: options.duration,
      target,
      ...(options.from === undefined ? {} : { from: options.from }),
      ...(trajectory === undefined ? {} : { trajectory }),
    } as MotionSegment<PropertyMap[K]["initial"]>;
    this.#object.properties = {
      ...this.#object.properties,
      [name]: { ...property, segments: [...property.segments, segment] },
    };
    return this;
  }

  moveTo(target: Vec2, options: MoveOptions): this {
    return this.#addMotion("position", target, options, options.trajectory);
  }

  rotateTo(target: Angle, options: MotionOptions<Angle>): this {
    return this.#addMotion("rotation", target, options);
  }

  fadeTo(target: Opacity, options: MotionOptions<Opacity>): this {
    return this.#addMotion("opacity", target, options);
  }

  depthTo(target: Depth, options: MotionOptions<Depth>): this {
    return this.#addMotion("depth", target, options);
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
