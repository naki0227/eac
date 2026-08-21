import type { Angle, Depth, Length, Opacity, Time } from "@eac/units";
import type { ReactiveSceneIR } from "./reactive-types.js";

export type Vec2 = Readonly<{ x: Length; y: Length }>;
export type Scale2 = Readonly<{ kind: "scale"; x: number; y: number }>;
export type ColorIR = Readonly<{
  kind: "color";
  red: number;
  green: number;
  blue: number;
  alpha: number;
}>;
export type PropertyName = "position" | "rotation" | "scale" | "opacity" | "depth";
export type StylePropertyName = "fill" | "stroke" | "blur";
export type PropertyValue = Vec2 | Scale2 | ColorIR | Angle | Opacity | Depth | Length;

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
export type MoveTrajectory = LinearTrajectory | BezierTrajectory | CycloidTrajectory;
export type EllipseTrajectory = Readonly<{
  kind: "ellipse";
  center: Vec2;
  radiusX: Length;
  radiusY: Length;
  rotation: Angle;
  startAngle: Angle;
  endAngle: Angle;
}>;
export type OrbitTrajectory = Readonly<{
  kind: "orbit";
  center: Vec2;
  radius: Length;
  startAngle: Angle;
  turns: number;
}>;
export type SpiralTrajectory = Readonly<{
  kind: "spiral";
  center: Vec2;
  startRadius: Length;
  endRadius: Length;
  turns: number;
  startAngle: Angle;
}>;
export type WaveTrajectory = Readonly<{
  kind: "wave";
  start: Vec2;
  end: Vec2;
  amplitude: Length;
  cycles: number;
  phase: Angle;
}>;
export type PathTrajectory =
  EllipseTrajectory | OrbitTrajectory | SpiralTrajectory | WaveTrajectory;
export type Trajectory = MoveTrajectory | PathTrajectory;

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
  fontFamily: string;
  fontWeight: number;
  textAlign: "start" | "middle" | "end";
  letterSpacing: Length;
}>;
export type PathGeometry = Readonly<{
  kind: "path";
  points: readonly Vec2[];
  closed: boolean;
}>;
export type LocalAssetIR = Readonly<{ kind: "local"; path: string }>;
export type EmbeddedAssetIR = Readonly<{
  kind: "embedded";
  path: string;
  mimeType: "image/png" | "image/jpeg" | "image/svg+xml";
  data: string;
  intrinsicWidth: number;
  intrinsicHeight: number;
}>;
export type InvalidAssetIR = Readonly<{
  kind: "invalid";
  path: string;
  reason: "missing" | "unsupported-format" | "invalid-dimensions" | "invalid-reference";
  detail: string;
}>;
export type AssetIR = LocalAssetIR | EmbeddedAssetIR | InvalidAssetIR;
export type EmbeddedAudioAssetIR = Readonly<{
  kind: "embedded-audio";
  path: string;
  mimeType: "audio/wav";
  data: string;
  duration: Time;
}>;
export type InvalidAudioAssetIR = Readonly<{
  kind: "invalid-audio";
  path: string;
  reason: "missing" | "unsupported-format" | "invalid-reference";
  detail: string;
}>;
export type AudioAssetIR = LocalAssetIR | EmbeddedAudioAssetIR | InvalidAudioAssetIR;
export type AudioClipIR = Readonly<{
  id: string;
  asset: AudioAssetIR;
  start: Time;
  duration?: Time;
  trimStart: Time;
  trimEnd?: Time;
  volume: number;
  fadeIn: Time;
  fadeOut: Time;
}>;
export type ImageGeometry = Readonly<{
  kind: "image";
  asset: AssetIR;
  width: Length;
  height: Length;
  fit: "contain" | "cover" | "fill";
}>;
export type GeometryIR =
  RectGeometry | CircleGeometry | TextGeometry | PathGeometry | ImageGeometry;

export type ShadowIR = Readonly<{
  offsetX: Length;
  offsetY: Length;
  blur: Length;
  color: ColorIR;
}>;
export type StylePropertyMap = Readonly<{
  fill: TimedProperty<ColorIR>;
  stroke: TimedProperty<ColorIR>;
  blur: TimedProperty<Length>;
}>;
export type AppearanceIR = StylePropertyMap &
  Readonly<{
    strokeWidth: Length;
    shadow?: ShadowIR;
  }>;
export type PropertyMap = Readonly<{
  position: TimedProperty<Vec2>;
  rotation: TimedProperty<Angle>;
  scale: TimedProperty<Scale2>;
  opacity: TimedProperty<Opacity>;
  depth: TimedProperty<Depth>;
}>;

export type TransformNodeIR = Readonly<{
  id: string;
  properties: PropertyMap;
  dependencies: readonly string[];
  unsupportedProperties: readonly UnsupportedProperty[];
  sourceOrder: number;
}>;

export type ObjectIR = TransformNodeIR &
  Readonly<{
    kind: "object";
    geometry: GeometryIR;
    appearance: AppearanceIR;
    /** Decorative nodes opt out so a backdrop cannot swallow every pointer interaction. */
    interactive: boolean;
  }>;

export type GroupIR = TransformNodeIR &
  Readonly<{
    kind: "group";
    children: readonly NodeIR[];
  }>;

export type NodeIR = ObjectIR | GroupIR;

export type SceneIR = Readonly<{
  id: string;
  start: Time;
  duration: Time;
  nodes: readonly NodeIR[];
  audioClips: readonly AudioClipIR[];
  reactive: ReactiveSceneIR;
}>;

export type ExperienceIR = Readonly<{
  version: "0.3";
  irVersion: 3;
  name: string;
  canvas: Readonly<{ width: Length; height: Length }>;
  duration: Time;
  fps: number;
  scenes: readonly SceneIR[];
}>;
