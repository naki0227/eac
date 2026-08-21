import type { Angle, Depth, Length, Opacity, Time } from "@eac/units";

export type Vec2 = Readonly<{ x: Length; y: Length }>;
export type Scale2 = Readonly<{ kind: "scale"; x: number; y: number }>;
export type PropertyName = "position" | "rotation" | "scale" | "opacity" | "depth";
export type PropertyValue = Vec2 | Scale2 | Angle | Opacity | Depth;

export type Easing =
  | Readonly<{ kind: "linear" }>
  | Readonly<{ kind: "ease-in" }>
  | Readonly<{ kind: "ease-out" }>
  | Readonly<{ kind: "ease-in-out" }>
  | Readonly<{
      kind: "cubic-bezier";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    }>;

export type LinearTrajectory = Readonly<{ kind: "linear" }>;
export type BezierTrajectory = Readonly<{
  kind: "bezier";
  control1: Vec2;
  control2: Vec2;
}>;
export type CycloidTrajectory = Readonly<{
  kind: "cycloid";
  radius: Length;
  turns?: number;
}>;
export type Trajectory = LinearTrajectory | BezierTrajectory | CycloidTrajectory;

export type MotionSegment<T extends PropertyValue> = Readonly<{
  id: string;
  start: Time;
  duration: Time;
  target: T;
  from?: T;
  easing?: Easing;
  trajectory?: T extends Vec2 ? Trajectory : never;
}>;

export type TimedProperty<T extends PropertyValue> = Readonly<{
  kind: "timed";
  initial: T;
  segments: readonly MotionSegment<T>[];
}>;

export type UnsupportedProperty = Readonly<{
  kind: "reactive" | "simulated";
  name: string;
}>;

export type RectGeometry = Readonly<{
  kind: "rect";
  width: Length;
  height: Length;
  cornerRadius: Length;
}>;
export type CircleGeometry = Readonly<{ kind: "circle"; radius: Length }>;
export type TextGeometry = Readonly<{
  kind: "text";
  text: string;
  fontSize: Length;
  width?: Length;
}>;
export type PathGeometry = Readonly<{
  kind: "path";
  points: readonly Vec2[];
  closed: boolean;
  strokeWidth: Length;
}>;
export type GeometryIR = RectGeometry | CircleGeometry | TextGeometry | PathGeometry;

export type AppearanceIR = Readonly<{ fill: string; stroke?: string }>;
export type PropertyMap = Readonly<{
  position: TimedProperty<Vec2>;
  rotation: TimedProperty<Angle>;
  scale: TimedProperty<Scale2>;
  opacity: TimedProperty<Opacity>;
  depth: TimedProperty<Depth>;
}>;

export type ObjectIR = Readonly<{
  id: string;
  geometry: GeometryIR;
  appearance: AppearanceIR;
  properties: PropertyMap;
  dependencies: readonly string[];
  unsupportedProperties: readonly UnsupportedProperty[];
  sourceOrder: number;
}>;

export type SceneIR = Readonly<{
  id: string;
  start: Time;
  duration: Time;
  objects: readonly ObjectIR[];
}>;

export type ExperienceIR = Readonly<{
  version: "0.2";
  irVersion: 2;
  name: string;
  canvas: Readonly<{ width: Length; height: Length }>;
  duration: Time;
  fps: number;
  scenes: readonly SceneIR[];
}>;
