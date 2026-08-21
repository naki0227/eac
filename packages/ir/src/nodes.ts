import type { NodeIR, ObjectIR, PropertyValue, StylePropertyName, TimedProperty } from "./types.js";

export type NodeEntry = Readonly<{ node: NodeIR; path: readonly string[] }>;

export function walkNodes(nodes: readonly NodeIR[]): readonly NodeEntry[] {
  const entries: NodeEntry[] = [];
  const active = new Set<NodeIR>();
  const visit = (node: NodeIR, parentPath: readonly string[]): void => {
    if (active.has(node)) return;
    const path = [...parentPath, node.id];
    entries.push({ node, path });
    if (node.kind === "group") {
      active.add(node);
      for (const child of node.children) visit(child, path);
      active.delete(node);
    }
  };
  for (const node of nodes) visit(node, []);
  return entries;
}

export const visualObjects = (nodes: readonly NodeIR[]): readonly ObjectIR[] =>
  walkNodes(nodes).flatMap(({ node }) => (node.kind === "object" ? [node] : []));

export const stylePropertyEntries = (
  object: ObjectIR,
): readonly (readonly [StylePropertyName, TimedProperty<PropertyValue>])[] => [
  ["fill", object.appearance.fill],
  ["stroke", object.appearance.stroke],
  ["blur", object.appearance.blur],
];
