import { compareSourcePaths, type EvaluatedObject, type Matrix2D } from "./scene-evaluator.js";
import type { GeometryIR } from "./types.js";

/** Deterministic text advance model, shared with the checker's AABB harness. */
export function textBounds(
  geometry: Extract<GeometryIR, { kind: "text" }>,
): readonly [number, number, number, number] {
  const width =
    geometry.width?.value ??
    geometry.text.length * geometry.fontSize.value * 0.6 +
      Math.max(0, geometry.text.length - 1) * geometry.letterSpacing.value;
  const left =
    geometry.textAlign === "middle" ? -width / 2 : geometry.textAlign === "end" ? -width : 0;
  return [left, -geometry.fontSize.value, left + width, 0];
}

export function invertMatrix(matrix: Matrix2D): Matrix2D | undefined {
  const [a, b, c, d, e, f] = matrix;
  const determinant = a * d - b * c;
  if (!Number.isFinite(determinant) || determinant === 0) return undefined;
  return [
    d / determinant,
    -b / determinant,
    -c / determinant,
    a / determinant,
    (c * f - d * e) / determinant,
    (b * e - a * f) / determinant,
  ];
}

function containsLocalPoint(geometry: GeometryIR, x: number, y: number): boolean {
  if (geometry.kind === "circle") return Math.hypot(x, y) <= geometry.radius.value;
  if (geometry.kind === "rect" || geometry.kind === "image") {
    const halfWidth = geometry.width.value / 2;
    const halfHeight = geometry.height.value / 2;
    return x >= -halfWidth && x <= halfWidth && y >= -halfHeight && y <= halfHeight;
  }
  if (geometry.kind === "text") {
    const [left, top, right, bottom] = textBounds(geometry);
    return x >= left && x <= right && y >= top && y <= bottom;
  }
  const xs = geometry.points.map((point) => point.x.value);
  const ys = geometry.points.map((point) => point.y.value);
  return (
    x >= Math.min(...xs) && x <= Math.max(...xs) && y >= Math.min(...ys) && y <= Math.max(...ys)
  );
}

/** True when the world-space point falls inside the node, exactly under its world transform. */
export function hitsObject(evaluated: EvaluatedObject, x: number, y: number): boolean {
  if (!evaluated.object.interactive) return false;
  if (evaluated.opacity <= 0) return false;
  const inverse = invertMatrix(evaluated.matrix);
  if (inverse === undefined) return false;
  const localX = inverse[0] * x + inverse[2] * y + inverse[4];
  const localY = inverse[1] * x + inverse[3] * y + inverse[5];
  if (!Number.isFinite(localX) || !Number.isFinite(localY)) return false;
  return containsLocalPoint(evaluated.object.geometry, localX, localY);
}

/**
 * Topmost target: highest world depth, then latest declaration order, then node id. This is the
 * exact reverse of the renderer's paint order, so the target is always the visually frontmost node.
 */
export function hitTest(
  objects: readonly EvaluatedObject[],
  x: number,
  y: number,
): string | undefined {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
  let best: EvaluatedObject | undefined;
  for (const candidate of objects) {
    if (!hitsObject(candidate, x, y)) continue;
    if (best === undefined || isInFront(candidate, best)) best = candidate;
  }
  return best?.object.id;
}

function isInFront(candidate: EvaluatedObject, current: EvaluatedObject): boolean {
  if (candidate.depth !== current.depth) return candidate.depth > current.depth;
  const path = compareSourcePaths(candidate.sourcePath, current.sourcePath);
  if (path !== 0) return path > 0;
  return candidate.object.id.localeCompare(current.object.id) > 0;
}
