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

function unit<K extends UnitKind>(kind: K, value: number): UnitValue<K> {
  if (!Number.isFinite(value)) throw new RangeError(`${kind} must be finite`);
  return Object.freeze({ kind, value });
}

export const sec = (value: number): Time => unit("time", value);
export const ms = (value: number): Time => sec(value / 1_000);
export const px = (value: number): Length => unit("length", value);
export const deg = (value: number): Angle => unit("angle", value);
export const rad = (value: number): Angle => deg((value * 180) / Math.PI);
export const opacity = (value: number): Opacity => {
  if (value < 0 || value > 1) throw new RangeError("opacity must be between 0 and 1");
  return unit("opacity", value);
};
export const depth = (value: number): Depth => unit("depth", value);

export function isUnit<K extends UnitKind>(value: unknown, kind: K): value is UnitValue<K> {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { kind?: unknown; value?: unknown };
  return candidate.kind === kind && typeof candidate.value === "number";
}

export function lerpUnit<K extends UnitKind>(
  from: UnitValue<K>,
  to: UnitValue<K>,
  progress: number,
): UnitValue<K> {
  if (from.kind !== to.kind) throw new TypeError(`cannot interpolate ${from.kind} and ${to.kind}`);
  return unit(from.kind, from.value + (to.value - from.value) * progress);
}
