export type UnitKind = "time" | "length" | "angle" | "opacity" | "depth";
export type UnitValue<K extends UnitKind> = Readonly<{
  kind: K;
  value: number;
}>;
export type Time = UnitValue<"time">;
export type Length = UnitValue<"length">;
export type Angle = UnitValue<"angle">;
export type Opacity = UnitValue<"opacity">;
export type Depth = UnitValue<"depth">;
export declare const sec: (value: number) => Time;
export declare const ms: (value: number) => Time;
export declare const px: (value: number) => Length;
export declare const deg: (value: number) => Angle;
export declare const rad: (value: number) => Angle;
export declare const opacity: (value: number) => Opacity;
export declare const depth: (value: number) => Depth;
export declare function isUnit<K extends UnitKind>(value: unknown, kind: K): value is UnitValue<K>;
export declare function lerpUnit<K extends UnitKind>(
  from: UnitValue<K>,
  to: UnitValue<K>,
  progress: number,
): UnitValue<K>;
//# sourceMappingURL=index.d.ts.map
