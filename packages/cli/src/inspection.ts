import type { CheckResult } from "@eac/checker";
import { ExperienceSession } from "@eac/runtime";
import { printExpression, printSignal, expressionSignals, type ScenarioIR } from "@eac/ir";
import {
  audioClipDuration,
  stylePropertyEntries,
  type ExperienceIR,
  type NodeIR,
  type PropertyName,
  type PropertyValue,
  type TimedProperty,
} from "@eac/ir";

export type InspectionWriter = Readonly<{
  property: string;
  id: string;
  start: number;
  end: number;
}>;

export type InspectionNode = Readonly<{
  id: string;
  kind: "group" | "rect" | "circle" | "text" | "path" | "image";
  path: string;
  z: number;
  writers: readonly InspectionWriter[];
  children: readonly InspectionNode[];
}>;

export type Inspection = Readonly<{
  version: string;
  irVersion: number;
  name: string;
  canvas: Readonly<{ width: number; height: number }>;
  duration: number;
  fps: number;
  scenes: readonly Readonly<{
    id: string;
    start: number;
    end: number;
    nodes: readonly InspectionNode[];
  }>[];
  counts: Readonly<{
    scenes: number;
    nodes: number;
    groups: number;
    objects: number;
    images: number;
    audioClips: number;
    timedProperties: number;
    writers: number;
    unsupportedProperties: number;
    maxDepth: number;
  }>;
  assets: readonly Readonly<{ node: string; path: string; status: string }>[];
  signals: readonly string[];
  states: readonly Readonly<{ scene: string; name: string; valueKind: string; initial: string }>[];
  bindings: readonly Readonly<{ scene: string; target: string; expression: string }>[];
  rules: readonly Readonly<{
    scene: string;
    id: string;
    trigger: string;
    actions: readonly string[];
    guard?: string;
  }>[];
  scenarioReplay?: Readonly<{
    name: string;
    steps: number;
    events: number;
    transitions: readonly Readonly<{
      at: number;
      event: string;
      target?: string;
      state: string;
      from: string;
      to: string;
    }>[];
  }>;
  audioClips: readonly Readonly<{
    id: string;
    scene: string;
    path: string;
    start: number;
    end?: number;
    trimStart: number;
    trimEnd?: number;
    volume: number;
    fadeIn: number;
    fadeOut: number;
  }>[];
  validation: Readonly<{ errors: number; warnings: number }>;
}>;

const writersFor = (
  path: string,
  name: string,
  property: TimedProperty<PropertyValue>,
): readonly InspectionWriter[] =>
  [...property.segments]
    .sort((left, right) => left.start.value - right.start.value || left.id.localeCompare(right.id))
    .map((segment) => ({
      property: `${path}.${name}`,
      id: segment.id,
      start: segment.start.value,
      end: segment.start.value + segment.duration.value,
    }));

function inspectNode(node: NodeIR, parentPath: string, active: Set<NodeIR>): InspectionNode {
  const path = `${parentPath}.${node.id}`;
  const transformWriters = (Object.keys(node.properties) as PropertyName[]).flatMap((name) =>
    writersFor(path, name, node.properties[name]),
  );
  const styleWriters =
    node.kind === "object"
      ? stylePropertyEntries(node).flatMap(([name, property]) => writersFor(path, name, property))
      : [];
  const isCycle = active.has(node);
  const nextActive = new Set(active).add(node);
  return {
    id: node.id,
    kind: node.kind === "group" ? "group" : node.geometry.kind,
    path,
    z: node.properties.depth.initial.value,
    writers: [...transformWriters, ...styleWriters],
    children:
      node.kind === "group" && !isCycle
        ? node.children.map((child) => inspectNode(child, path, nextActive))
        : [],
  };
}

const flatten = (nodes: readonly InspectionNode[]): readonly InspectionNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)]);

const depthOf = (node: InspectionNode): number => 1 + Math.max(0, ...node.children.map(depthOf));

const triggerLabel = (trigger: { kind: string; node?: string; code?: string }): string =>
  trigger.node !== undefined
    ? `${trigger.kind}(${trigger.node})`
    : trigger.code !== undefined
      ? `${trigger.kind}("${trigger.code}")`
      : trigger.kind;

const actionLabel = (action: {
  kind: string;
  state?: string;
  sound?: string;
  value?: Parameters<typeof printExpression>[0];
}): string => {
  if (action.kind === "toggleState") return `toggle(${String(action.state)})`;
  if (action.kind === "playSound") return `playSound(${String(action.sound)})`;
  return `set(${String(action.state)}, ${action.value === undefined ? "?" : printExpression(action.value)})`;
};

function inspectReactive(experience: ExperienceIR) {
  const signals = new Set<string>();
  const states: Inspection["states"][number][] = [];
  const bindings: Inspection["bindings"][number][] = [];
  const rules: Inspection["rules"][number][] = [];
  for (const scene of experience.scenes) {
    for (const state of scene.reactive.states)
      states.push({
        scene: scene.id,
        name: state.name,
        valueKind: state.valueKind,
        initial: String(state.initial),
      });
    for (const binding of scene.reactive.bindings) {
      const parts =
        "value" in binding
          ? [{ label: binding.property, expression: binding.value }]
          : "progress" in binding
            ? [{ label: `${binding.property}.progress`, expression: binding.progress }]
            : [
                { label: `${binding.property}.x`, expression: binding.x },
                { label: `${binding.property}.y`, expression: binding.y },
              ];
      for (const part of parts) {
        for (const ref of expressionSignals(part.expression)) signals.add(printSignal(ref));
        bindings.push({
          scene: scene.id,
          target: `${binding.node}.${part.label}`,
          expression: printExpression(part.expression),
        });
      }
    }
    for (const rule of scene.reactive.rules) {
      if (rule.guard !== undefined)
        for (const ref of expressionSignals(rule.guard)) signals.add(printSignal(ref));
      rules.push({
        scene: scene.id,
        id: rule.id,
        trigger: triggerLabel(rule.trigger),
        actions: rule.actions.map(actionLabel),
        ...(rule.guard === undefined ? {} : { guard: printExpression(rule.guard) }),
      });
    }
  }
  return { signals: [...signals].sort(), states, bindings, rules };
}

export function inspectExperience(
  experience: ExperienceIR,
  result: CheckResult,
  scenario?: ScenarioIR,
): Inspection {
  const scenes = experience.scenes.map((scene) => ({
    id: scene.id,
    start: scene.start.value,
    end: scene.start.value + scene.duration.value,
    nodes: scene.nodes.map((node) => inspectNode(node, scene.id, new Set())),
  }));
  const nodes = scenes.flatMap((scene) => flatten(scene.nodes));
  const imageAssets = experience.scenes.flatMap((scene) =>
    collectAssets(scene.nodes, scene.id, new Set()),
  );
  const audioClips = experience.scenes.flatMap((scene) =>
    scene.audioClips.map((clip) => {
      const duration = audioClipDuration(clip);
      return {
        id: clip.id,
        scene: scene.id,
        path: clip.asset.path,
        start: clip.start.value,
        ...(duration === undefined ? {} : { end: clip.start.value + duration }),
        trimStart: clip.trimStart.value,
        ...(clip.trimEnd === undefined ? {} : { trimEnd: clip.trimEnd.value }),
        volume: clip.volume,
        fadeIn: clip.fadeIn.value,
        fadeOut: clip.fadeOut.value,
      };
    }),
  );
  const audioAssets = experience.scenes.flatMap((scene) =>
    scene.audioClips.map((clip) => ({
      node: `${scene.id}.audio.${clip.id}`,
      path: clip.asset.path,
      status: clip.asset.kind,
    })),
  );
  const reactive = inspectReactive(experience);
  const replay =
    scenario === undefined
      ? undefined
      : (() => {
          const session = new ExperienceSession(experience, scenario);
          const final = session.replayTo(scenario.duration.value);
          return {
            name: scenario.name,
            steps: session.steps.length,
            events: final.events.length,
            transitions: final.transitions.map((item) => ({
              at: item.at,
              event: item.event,
              ...(item.target === undefined ? {} : { target: item.target }),
              state: item.state,
              from: String(item.from),
              to: String(item.to),
            })),
          };
        })();
  return {
    version: experience.version,
    irVersion: experience.irVersion,
    name: experience.name,
    canvas: { width: experience.canvas.width.value, height: experience.canvas.height.value },
    duration: experience.duration.value,
    fps: experience.fps,
    scenes,
    counts: {
      scenes: scenes.length,
      nodes: nodes.length,
      groups: nodes.filter((node) => node.kind === "group").length,
      objects: nodes.filter((node) => node.kind !== "group").length,
      images: nodes.filter((node) => node.kind === "image").length,
      audioClips: audioClips.length,
      timedProperties: result.stats.timedProperties,
      writers: nodes.reduce((total, node) => total + node.writers.length, 0),
      unsupportedProperties: experience.scenes.reduce(
        (total, scene) => total + countUnsupported(scene.nodes, new Set()),
        0,
      ),
      maxDepth: Math.max(0, ...scenes.flatMap((scene) => scene.nodes.map(depthOf))),
    },
    assets: [...imageAssets, ...audioAssets],
    ...reactive,
    ...(replay === undefined ? {} : { scenarioReplay: replay }),
    audioClips,
    validation: { errors: result.errors, warnings: result.warnings },
  };
}

function collectAssets(
  nodes: readonly NodeIR[],
  parentPath: string,
  active: Set<NodeIR>,
): readonly Readonly<{ node: string; path: string; status: string }>[] {
  return nodes.flatMap((node) => {
    const path = `${parentPath}.${node.id}`;
    const own =
      node.kind === "object" && node.geometry.kind === "image"
        ? [{ node: path, path: node.geometry.asset.path, status: node.geometry.asset.kind }]
        : [];
    if (node.kind !== "group" || active.has(node)) return own;
    return [...own, ...collectAssets(node.children, path, new Set(active).add(node))];
  });
}

function countUnsupported(nodes: readonly NodeIR[], active: Set<NodeIR>): number {
  return nodes.reduce((total, node) => {
    if (active.has(node)) return total + node.unsupportedProperties.length;
    const next = new Set(active).add(node);
    return (
      total +
      node.unsupportedProperties.length +
      (node.kind === "group" ? countUnsupported(node.children, next) : 0)
    );
  }, 0);
}

const nodeLabel = (node: InspectionNode): string =>
  `${node.kind === "group" ? "Group" : node.kind[0]?.toUpperCase()}${node.kind === "group" ? "" : node.kind.slice(1)} ${node.id} [z=${node.z}]`;

function treeLines(nodes: readonly InspectionNode[], prefix = ""): readonly string[] {
  return nodes.flatMap((node, index) => {
    const last = index === nodes.length - 1;
    const branch = last ? "└─ " : "├─ ";
    const childPrefix = `${prefix}${last ? "   " : "│  "}`;
    return [`${prefix}${branch}${nodeLabel(node)}`, ...treeLines(node.children, childPrefix)];
  });
}

export function formatInspection(inspection: Inspection): string {
  const trees = inspection.scenes.flatMap((scene) => [
    `Scene ${scene.id} (${scene.start.toFixed(3)}s..${scene.end.toFixed(3)}s)`,
    ...treeLines(scene.nodes),
  ]);
  const writers = inspection.scenes
    .flatMap((scene) => flatten(scene.nodes))
    .flatMap((node) => node.writers)
    .map(
      (writer) =>
        `${writer.property}\n  ${writer.start.toFixed(3)}s..${writer.end.toFixed(3)}s ${writer.id}`,
    );
  const assets = inspection.assets.map(
    (asset) => `${asset.node}\n  ${asset.path} [${asset.status}]`,
  );
  const audio = inspection.audioClips.map(
    (clip) =>
      `${clip.scene}.audio.${clip.id}\n  ${clip.start.toFixed(3)}s..${clip.end?.toFixed(3) ?? "?"}s volume=${clip.volume} trim=${clip.trimStart.toFixed(3)}s..${clip.trimEnd?.toFixed(3) ?? "source-end"} fade=${clip.fadeIn.toFixed(3)}s/${clip.fadeOut.toFixed(3)}s`,
  );
  const states = inspection.states.map(
    (state) => `${state.scene}.${state.name}: ${state.valueKind} = ${state.initial}`,
  );
  const bindings = inspection.bindings.map(
    (binding) => `${binding.target}\n  <- ${binding.expression}`,
  );
  const rules = inspection.rules.map(
    (rule) =>
      `${rule.trigger}${rule.guard === undefined ? "" : ` [when ${rule.guard}]`}\n  -> ${rule.actions.join(", ")}`,
  );
  const replay =
    inspection.scenarioReplay === undefined
      ? ""
      : `\n\nScenario ${inspection.scenarioReplay.name}:\n${inspection.scenarioReplay.steps} replay steps\n${inspection.scenarioReplay.events} semantic events\n\nState transitions:\n${
          inspection.scenarioReplay.transitions
            .map(
              (item) =>
                `t=${item.at.toFixed(3)} ${item.event}(${item.target ?? "-"})\n  ${item.state} ${item.from} → ${item.to}`,
            )
            .join("\n") || "(none)"
        }`;
  const reactive = `\n\nSignals:\n${inspection.signals.join("\n") || "(none)"}\n\nState:\n${states.join("\n") || "(none)"}\n\nBindings:\n${bindings.join("\n") || "(none)"}\n\nRules:\n${rules.join("\n") || "(none)"}${replay}`;
  return `Experience: ${inspection.name}\nVersion: ${inspection.version} (IR ${inspection.irVersion})\nCanvas: ${inspection.canvas.width}x${inspection.canvas.height}\nTimeline: ${inspection.duration}s at ${inspection.fps}fps\n\nSummary:\n${inspection.counts.scenes} scenes\n${inspection.counts.nodes} nodes (${inspection.counts.groups} groups, ${inspection.counts.objects} objects, ${inspection.counts.images} images)\n${inspection.counts.audioClips} audio clips\n${inspection.counts.timedProperties} timed properties\n${inspection.counts.writers} writers\n${inspection.counts.unsupportedProperties} unsupported properties\n${inspection.counts.maxDepth} max tree depth\n\nNode tree:\n${trees.join("\n") || "(empty)"}\n\nWriters:\n${writers.join("\n") || "(none)"}\n\nAudio clips:\n${audio.join("\n") || "(none)"}\n\nAssets:\n${assets.join("\n") || "(none)"}${reactive}\n\nValidation:\n${inspection.validation.errors} errors\n${inspection.validation.warnings} warnings`;
}
