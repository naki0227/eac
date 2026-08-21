import type {
  AppearanceIR,
  GeometryIR,
  ObjectIR,
  PropertyMap,
  PropertyName,
  PropertyValue,
  Trajectory,
  UnsupportedProperty,
  Vec2,
} from "@eac/ir";
import type { Angle, Depth, Opacity, Time } from "@eac/units";
type MotionOptions<T extends PropertyValue> = Readonly<{
  at: Time;
  duration: Time;
  from?: T;
}>;
export type MoveOptions = MotionOptions<Vec2> &
  Readonly<{
    trajectory?: Trajectory;
  }>;
export declare class ObjectBuilder {
  #private;
  constructor(
    id: string,
    geometry: GeometryIR,
    appearance: AppearanceIR,
    properties: PropertyMap,
    sourceOrder: number,
  );
  get ir(): ObjectIR;
  moveTo(target: Vec2, options: MoveOptions): this;
  rotateTo(target: Angle, options: MotionOptions<Angle>): this;
  fadeTo(target: Opacity, options: MotionOptions<Opacity>): this;
  depthTo(target: Depth, options: MotionOptions<Depth>): this;
  bringForward(
    options: Readonly<{
      at: Time;
      duration: Time;
      to: Depth;
    }>,
  ): this;
  dependsOn(object: ObjectBuilder, property?: PropertyName): this;
  unsupported(kind: UnsupportedProperty["kind"], name: string): this;
}
export {};
//# sourceMappingURL=object-builder.d.ts.map
