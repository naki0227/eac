import type { Trajectory } from "@eac/ir";
import { isUnit, type UnitValue } from "@eac/units";

const finiteUnit = <K extends "length" | "angle">(value: unknown, kind: K): value is UnitValue<K> =>
  isUnit(value, kind) && Number.isFinite(value.value);

const finiteVector = (
  value: unknown,
): value is Readonly<{ x: UnitValue<"length">; y: UnitValue<"length"> }> => {
  if (typeof value !== "object" || value === null) return false;
  const vector = value as { x?: unknown; y?: unknown };
  return finiteUnit(vector.x, "length") && finiteUnit(vector.y, "length");
};

const positiveNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;
const positiveLength = (value: unknown): value is UnitValue<"length"> =>
  finiteUnit(value, "length") && value.value > 0;
const nonNegativeLength = (value: unknown): value is UnitValue<"length"> =>
  finiteUnit(value, "length") && value.value >= 0;

export function isValidTrajectory(value: unknown): value is Trajectory {
  if (typeof value !== "object" || value === null) return false;
  const path = value as Record<string, unknown>;
  if (path.kind === "linear") return true;
  if (path.kind === "bezier") return finiteVector(path.control1) && finiteVector(path.control2);
  if (path.kind === "cycloid")
    return positiveLength(path.radius) && (path.turns === undefined || positiveNumber(path.turns));
  if (path.kind === "ellipse")
    return (
      finiteVector(path.center) &&
      positiveLength(path.radiusX) &&
      positiveLength(path.radiusY) &&
      finiteUnit(path.rotation, "angle") &&
      finiteUnit(path.startAngle, "angle") &&
      finiteUnit(path.endAngle, "angle") &&
      path.startAngle.value !== path.endAngle.value
    );
  if (path.kind === "orbit")
    return (
      finiteVector(path.center) &&
      positiveLength(path.radius) &&
      finiteUnit(path.startAngle, "angle") &&
      positiveNumber(path.turns)
    );
  if (path.kind === "spiral")
    return (
      finiteVector(path.center) &&
      nonNegativeLength(path.startRadius) &&
      nonNegativeLength(path.endRadius) &&
      (path.startRadius.value > 0 || path.endRadius.value > 0) &&
      finiteUnit(path.startAngle, "angle") &&
      positiveNumber(path.turns)
    );
  if (path.kind === "wave")
    return (
      finiteVector(path.start) &&
      finiteVector(path.end) &&
      (path.start.x.value !== path.end.x.value || path.start.y.value !== path.end.y.value) &&
      positiveLength(path.amplitude) &&
      positiveNumber(path.cycles) &&
      finiteUnit(path.phase, "angle")
    );
  return false;
}
