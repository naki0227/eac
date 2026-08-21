import { walkNodes, type ExperienceIR, type NodeIR, type PropertyName } from "@eac/ir";
import { error, type Diagnostic } from "./diagnostic.js";
import { runValueRules } from "./value-rules.js";

function timeline(experience: ExperienceIR): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const scene of experience.scenes) {
    if (
      scene.start.value < 0 ||
      scene.duration.value <= 0 ||
      scene.start.value + scene.duration.value > experience.duration.value
    ) {
      diagnostics.push(
        error(
          "eac::timeline::invalid-range",
          `Scene \`${scene.id}\` has an invalid time range.`,
          `scene ${scene.id}: ${scene.start.value}s–${scene.start.value + scene.duration.value}s`,
          "Scenes must start at or after 0, have positive duration, and fit within the experience.",
          ["change the scene's at", "shorten the scene's duration"],
        ),
      );
    }
    for (const { node } of walkNodes(scene.nodes)) {
      for (const name of Object.keys(node.properties) as PropertyName[]) {
        for (const segment of node.properties[name].segments) {
          if (
            segment.start.value < 0 ||
            segment.duration.value <= 0 ||
            segment.start.value + segment.duration.value > scene.duration.value
          ) {
            diagnostics.push(
              error(
                "eac::timeline::invalid-range",
                `Motion \`${segment.id}\` has an invalid time range.`,
                `${scene.id}.${node.id}.${name}: ${segment.start.value}s–${segment.start.value + segment.duration.value}s`,
                "Motions must start at or after 0, have positive duration, and fit within their scene.",
                ["change the motion's at", "shorten the motion's duration"],
              ),
            );
          }
        }
      }
    }
  }
  return diagnostics;
}

function conflicts(experience: ExperienceIR): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const scene of experience.scenes)
    for (const { node } of walkNodes(scene.nodes)) {
      for (const name of Object.keys(node.properties) as PropertyName[]) {
        const segments = [...node.properties[name].segments].sort(
          (a, b) => a.start.value - b.start.value,
        );
        for (let index = 0; index < segments.length; index++)
          for (let otherIndex = index + 1; otherIndex < segments.length; otherIndex++) {
            const first = segments[index];
            const second = segments[otherIndex];
            if (!first || !second) continue;
            const overlapStart = Math.max(first.start.value, second.start.value);
            const overlapEnd = Math.min(
              first.start.value + first.duration.value,
              second.start.value + second.duration.value,
            );
            if (overlapStart < overlapEnd)
              diagnostics.push(
                error(
                  "eac::motion::conflicting-writers",
                  `\`${node.id}.${name}\` has multiple writers between ${overlapStart.toFixed(2)}s and ${overlapEnd.toFixed(2)}s.`,
                  `${scene.id}.${node.id}.${name}`,
                  "EaC v0.2 allows only one writer per property for any point in time.",
                  ["change one motion's at", "shorten one motion's duration"],
                  [
                    `${first.id}  ${first.start.value.toFixed(1)} ━━━ ${first.start.value + first.duration.value}s`,
                    `${second.id}  ${second.start.value.toFixed(1)} ━━━ ${second.start.value + second.duration.value}s`,
                  ],
                ),
              );
          }
      }
    }
  return diagnostics;
}

function unsupported(experience: ExperienceIR): Diagnostic[] {
  return experience.scenes.flatMap((scene) =>
    walkNodes(scene.nodes).flatMap(({ node }) =>
      node.unsupportedProperties.map((property) =>
        error(
          `eac::property::${property.kind}-unsupported`,
          `${property.kind === "reactive" ? "ReactiveProperty" : "SimulatedProperty"} is not supported by EaC v0.2.`,
          `${scene.id}.${node.id}.${property.name}`,
          "v0.2 guarantees direct seeking and supports TimedProperty only.",
          ["replace it with a TimedProperty", "remove the unsupported property"],
        ),
      ),
    ),
  );
}

function cycles(experience: ExperienceIR): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const edges = new Map<string, readonly string[]>();
  for (const scene of experience.scenes)
    for (const { node } of walkNodes(scene.nodes))
      edges.set(`${node.id}.position`, node.dependencies);
  const active = new Set<string>();
  const done = new Set<string>();
  const visit = (node: string, trail: readonly string[]): void => {
    if (active.has(node)) {
      const start = trail.indexOf(node);
      const path = [...trail.slice(start), node];
      diagnostics.push(
        error(
          "eac::dependency::cycle",
          "Cyclic dependency detected.",
          path.join("\n   ↓\n"),
          "A cyclic property graph has no deterministic evaluation order.",
          ["remove one dependency in the cycle"],
        ),
      );
      return;
    }
    if (done.has(node)) return;
    active.add(node);
    for (const target of edges.get(node) ?? []) visit(target, [...trail, node]);
    active.delete(node);
    done.add(node);
  };
  for (const node of edges.keys()) visit(node, []);
  return diagnostics;
}

function hierarchy(experience: ExperienceIR): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const scene of experience.scenes) {
    const active = new Set<NodeIR>();
    const visit = (node: NodeIR, path: readonly string[]): void => {
      if (active.has(node)) {
        diagnostics.push(
          error(
            "eac::hierarchy::cycle",
            "Cyclic group hierarchy detected.",
            [...path, node.id].join(" → "),
            "A node tree must have a finite parent-to-child evaluation order.",
            ["remove the child reference that points back to an ancestor"],
          ),
        );
        return;
      }
      if (node.kind !== "group") return;
      active.add(node);
      for (const child of node.children) visit(child, [...path, node.id]);
      active.delete(node);
    };
    for (const node of scene.nodes) visit(node, [scene.id]);
  }
  return diagnostics;
}

export function runStaticRules(experience: ExperienceIR): Diagnostic[] {
  const fpsDiagnostic =
    !Number.isInteger(experience.fps) || experience.fps <= 0
      ? [
          error(
            "eac::timeline::invalid-fps",
            `FPS \`${String(experience.fps)}\` is invalid.`,
            "experience.fps",
            "Sampling and rendering require a positive integer FPS.",
            ["set fps to a positive integer such as 30 or 60"],
          ),
        ]
      : [];
  return [
    ...fpsDiagnostic,
    ...hierarchy(experience),
    ...timeline(experience),
    ...runValueRules(experience),
    ...unsupported(experience),
    ...conflicts(experience),
    ...cycles(experience),
  ];
}
