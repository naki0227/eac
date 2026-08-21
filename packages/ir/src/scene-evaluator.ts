import { evaluateTimedProperty } from "./evaluate.js";
import type { ColorIR, NodeIR, ObjectIR, SceneIR, ShadowIR } from "./types.js";

/**
 * Reactive output for one node, produced once per replay step. An absent field keeps the node's
 * TimedProperty, so a scene with no bindings evaluates exactly as it did in v0.2.
 */
export type NodeOverride = Readonly<{
  position?: Readonly<{ x: number; y: number }>;
  rotation?: number;
  scale?: Readonly<{ x: number; y: number }>;
  opacity?: number;
  depth?: number;
  blur?: number;
  fill?: ColorIR;
  stroke?: ColorIR;
}>;
export type ReactiveOverrides = ReadonlyMap<string, NodeOverride>;
const NO_OVERRIDES: ReactiveOverrides = new Map();

export type Matrix2D = readonly [number, number, number, number, number, number];

export type EvaluatedObject = Readonly<{
  object: ObjectIR;
  appearance: Readonly<{
    fill: ColorIR;
    stroke: ColorIR;
    strokeWidth: number;
    blur: number;
    shadow?: ShadowIR;
  }>;
  matrix: Matrix2D;
  opacity: number;
  depth: number;
  sourcePath: readonly number[];
}>;

export const identityMatrix = (): Matrix2D => [1, 0, 0, 1, 0, 0];

export function multiplyMatrices(left: Matrix2D, right: Matrix2D): Matrix2D {
  const [a1, b1, c1, d1, e1, f1] = left;
  const [a2, b2, c2, d2, e2, f2] = right;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
}

export function evaluateLocalMatrix(
  node: NodeIR,
  time: number,
  override: NodeOverride = {},
): Matrix2D {
  const timedPosition = evaluateTimedProperty(node.properties.position, time);
  const position = override.position ?? {
    x: timedPosition.x.value,
    y: timedPosition.y.value,
  };
  const degrees = override.rotation ?? evaluateTimedProperty(node.properties.rotation, time).value;
  const rotation = degrees * (Math.PI / 180);
  const scale = override.scale ?? evaluateTimedProperty(node.properties.scale, time);
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  return [
    cosine * scale.x,
    sine * scale.x,
    -sine * scale.y,
    cosine * scale.y,
    position.x,
    position.y,
  ];
}

export function transformPoint(matrix: Matrix2D, x: number, y: number): readonly [number, number] {
  return [matrix[0] * x + matrix[2] * y + matrix[4], matrix[1] * x + matrix[3] * y + matrix[5]];
}

export function evaluateScene(
  scene: SceneIR,
  localTime: number,
  overrides: ReactiveOverrides = NO_OVERRIDES,
): readonly EvaluatedObject[] {
  const leaves: EvaluatedObject[] = [];
  const active = new Set<NodeIR>();
  const visit = (
    node: NodeIR,
    parentMatrix: Matrix2D,
    parentOpacity: number,
    parentDepth: number,
    sourcePath: readonly number[],
  ): void => {
    if (active.has(node)) return;
    const override = overrides.get(node.id) ?? {};
    const matrix = multiplyMatrices(parentMatrix, evaluateLocalMatrix(node, localTime, override));
    const localOpacity =
      override.opacity ?? evaluateTimedProperty(node.properties.opacity, localTime).value;
    const opacity = parentOpacity * localOpacity;
    const depth =
      parentDepth +
      (override.depth ?? evaluateTimedProperty(node.properties.depth, localTime).value);
    if (node.kind === "object") {
      leaves.push({
        object: node,
        appearance: {
          fill: override.fill ?? evaluateTimedProperty(node.appearance.fill, localTime),
          stroke: override.stroke ?? evaluateTimedProperty(node.appearance.stroke, localTime),
          strokeWidth: node.appearance.strokeWidth.value,
          blur: override.blur ?? evaluateTimedProperty(node.appearance.blur, localTime).value,
          ...(node.appearance.shadow === undefined ? {} : { shadow: node.appearance.shadow }),
        },
        matrix,
        opacity,
        depth,
        sourcePath,
      });
      return;
    }
    active.add(node);
    node.children.forEach((child, index) =>
      visit(child, matrix, opacity, depth, [...sourcePath, index]),
    );
    active.delete(node);
  };
  scene.nodes.forEach((node, index) => visit(node, identityMatrix(), 1, 0, [index]));
  return leaves;
}

export const compareSourcePaths = (left: readonly number[], right: readonly number[]): number => {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index++) {
    const difference = (left[index] ?? -1) - (right[index] ?? -1);
    if (difference !== 0) return difference;
  }
  return 0;
};
