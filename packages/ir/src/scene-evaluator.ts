import { evaluateTimedProperty } from "./evaluate.js";
import type { NodeIR, ObjectIR, SceneIR } from "./types.js";

export type Matrix2D = readonly [number, number, number, number, number, number];

export type EvaluatedObject = Readonly<{
  object: ObjectIR;
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

export function evaluateLocalMatrix(node: NodeIR, time: number): Matrix2D {
  const position = evaluateTimedProperty(node.properties.position, time);
  const rotation = evaluateTimedProperty(node.properties.rotation, time).value * (Math.PI / 180);
  const scale = evaluateTimedProperty(node.properties.scale, time);
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  return [
    cosine * scale.x,
    sine * scale.x,
    -sine * scale.y,
    cosine * scale.y,
    position.x.value,
    position.y.value,
  ];
}

export function transformPoint(matrix: Matrix2D, x: number, y: number): readonly [number, number] {
  return [matrix[0] * x + matrix[2] * y + matrix[4], matrix[1] * x + matrix[3] * y + matrix[5]];
}

export function evaluateScene(scene: SceneIR, localTime: number): readonly EvaluatedObject[] {
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
    const matrix = multiplyMatrices(parentMatrix, evaluateLocalMatrix(node, localTime));
    const opacity = parentOpacity * evaluateTimedProperty(node.properties.opacity, localTime).value;
    const depth = parentDepth + evaluateTimedProperty(node.properties.depth, localTime).value;
    if (node.kind === "object") {
      leaves.push({ object: node, matrix, opacity, depth, sourcePath });
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
