import { px } from "@eac/units";
import type { MoveTrajectory, PathTrajectory, Vec2 } from "./types.js";

const radians = (degrees: number): number => (degrees * Math.PI) / 180;

export function isPathTrajectory(value: MoveTrajectory | PathTrajectory): value is PathTrajectory {
  return ["ellipse", "orbit", "spiral", "wave"].includes(value.kind);
}

export function evaluateMoveTrajectory(
  path: MoveTrajectory,
  from: Vec2,
  to: Vec2,
  progress: number,
): Vec2 {
  if (path.kind === "linear") {
    return {
      x: px(from.x.value + (to.x.value - from.x.value) * progress),
      y: px(from.y.value + (to.y.value - from.y.value) * progress),
    };
  }
  if (path.kind === "bezier") {
    const inverse = 1 - progress;
    const cubic = (a: number, b: number, c: number, d: number): number =>
      inverse ** 3 * a +
      3 * inverse ** 2 * progress * b +
      3 * inverse * progress ** 2 * c +
      progress ** 3 * d;
    return {
      x: px(cubic(from.x.value, path.control1.x.value, path.control2.x.value, to.x.value)),
      y: px(cubic(from.y.value, path.control1.y.value, path.control2.y.value, to.y.value)),
    };
  }
  const turns = path.turns ?? 1;
  const theta = progress * Math.PI * 2 * turns;
  const normalizedX = theta === 0 ? 0 : (theta - Math.sin(theta)) / (Math.PI * 2 * turns);
  const bump = path.radius.value * (1 - Math.cos(theta));
  return {
    x: px(from.x.value + (to.x.value - from.x.value) * normalizedX),
    y: px(from.y.value + (to.y.value - from.y.value) * progress - bump),
  };
}

function ellipsePoint(
  center: Vec2,
  radiusX: number,
  radiusY: number,
  angle: number,
  rotation: number,
): Vec2 {
  const localX = radiusX * Math.cos(angle);
  const localY = radiusY * Math.sin(angle);
  return {
    x: px(center.x.value + localX * Math.cos(rotation) - localY * Math.sin(rotation)),
    y: px(center.y.value + localX * Math.sin(rotation) + localY * Math.cos(rotation)),
  };
}

export function evaluatePathTrajectory(path: PathTrajectory, progress: number): Vec2 {
  const normalized = Math.max(0, Math.min(1, progress));
  if (path.kind === "ellipse") {
    const angle =
      radians(path.startAngle.value) +
      radians(path.endAngle.value - path.startAngle.value) * normalized;
    return ellipsePoint(
      path.center,
      path.radiusX.value,
      path.radiusY.value,
      angle,
      radians(path.rotation.value),
    );
  }
  if (path.kind === "orbit") {
    const angle = radians(path.startAngle.value) + Math.PI * 2 * path.turns * normalized;
    return ellipsePoint(path.center, path.radius.value, path.radius.value, angle, 0);
  }
  if (path.kind === "spiral") {
    const radius =
      path.startRadius.value + (path.endRadius.value - path.startRadius.value) * normalized;
    const angle = radians(path.startAngle.value) + Math.PI * 2 * path.turns * normalized;
    return ellipsePoint(path.center, radius, radius, angle, 0);
  }
  const x = path.start.x.value + (path.end.x.value - path.start.x.value) * normalized;
  const y = path.start.y.value + (path.end.y.value - path.start.y.value) * normalized;
  const dx = path.end.x.value - path.start.x.value;
  const dy = path.end.y.value - path.start.y.value;
  const length = Math.hypot(dx, dy);
  const wave =
    path.amplitude.value *
    Math.sin(radians(path.phase.value) + Math.PI * 2 * path.cycles * normalized);
  return { x: px(x + (-dy / length) * wave), y: px(y + (dx / length) * wave) };
}
