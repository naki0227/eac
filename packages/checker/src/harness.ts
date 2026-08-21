import {
  evaluateScene,
  transformPoint,
  visualObjects,
  walkNodes,
  type EvaluatedObject,
  type ExperienceIR,
} from "@eac/ir";
import { warning, type Diagnostic } from "./diagnostic.js";

type Box = Readonly<{ left: number; top: number; right: number; bottom: number }>;

function bounds(evaluated: EvaluatedObject): Box {
  const geometry = evaluated.object.geometry;
  const localPoints: readonly (readonly [number, number])[] =
    geometry.kind === "rect"
      ? [
          [-geometry.width.value / 2, -geometry.height.value / 2],
          [geometry.width.value / 2, -geometry.height.value / 2],
          [geometry.width.value / 2, geometry.height.value / 2],
          [-geometry.width.value / 2, geometry.height.value / 2],
        ]
      : geometry.kind === "circle"
        ? [
            [-geometry.radius.value, -geometry.radius.value],
            [geometry.radius.value, -geometry.radius.value],
            [geometry.radius.value, geometry.radius.value],
            [-geometry.radius.value, geometry.radius.value],
          ]
        : geometry.kind === "text"
          ? (() => {
              const width =
                geometry.width?.value ??
                geometry.text.length * geometry.fontSize.value * 0.6 +
                  Math.max(0, geometry.text.length - 1) * geometry.letterSpacing.value;
              const left =
                geometry.textAlign === "middle"
                  ? -width / 2
                  : geometry.textAlign === "end"
                    ? -width
                    : 0;
              return [
                [left, -geometry.fontSize.value],
                [left + width, -geometry.fontSize.value],
                [left + width, 0],
                [left, 0],
              ];
            })()
          : geometry.points.map((point) => [point.x.value, point.y.value]);
  const points = localPoints.map(([x, y]) => transformPoint(evaluated.matrix, x, y));
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return {
    left: Math.min(...xs),
    top: Math.min(...ys),
    right: Math.max(...xs),
    bottom: Math.max(...ys),
  };
}

const intersects = (a: Box, b: Box): boolean =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

export type HarnessStats = Readonly<{
  frames: number;
  objects: number;
  timedProperties: number;
  invalidTransforms: number;
}>;

export function runHarness(experience: ExperienceIR): {
  diagnostics: Diagnostic[];
  stats: HarnessStats;
} {
  const diagnostics: Diagnostic[] = [];
  let frames = 0;
  let invalidTransforms = 0;
  for (const scene of experience.scenes) {
    const frameCount = Math.max(1, Math.ceil(scene.duration.value * experience.fps));
    frames += frameCount;
    const overlaps = new Map<string, { from: number; to: number }>();
    for (let frame = 0; frame < frameCount; frame++) {
      const time = frame / experience.fps;
      const objects = evaluateScene(scene, time);
      for (const object of objects)
        if (JSON.stringify([object.matrix, object.opacity, object.depth]).includes("null"))
          invalidTransforms++;
      for (let index = 0; index < objects.length; index++)
        for (let otherIndex = index + 1; otherIndex < objects.length; otherIndex++) {
          const first = objects[index];
          const second = objects[otherIndex];
          if (!first || !second || !intersects(bounds(first), bounds(second))) continue;
          const key = `${first.object.id}\0${second.object.id}`;
          const interval = overlaps.get(key);
          overlaps.set(
            key,
            interval ? { from: interval.from, to: time } : { from: time, to: time },
          );
        }
    }
    for (const [key, interval] of overlaps) {
      const [first, second] = key.split("\0");
      if (first === undefined || second === undefined) continue;
      diagnostics.push(
        warning(
          "eac::layout::aabb-overlap",
          `\`${first}\` overlaps \`${second}\` between approximately ${interval.from.toFixed(2)}s and ${interval.to.toFixed(2)}s.`,
          `scene ${scene.id}`,
          "This approximate AABB check may indicate obscured content; rotations and alpha are not considered.",
          ["move one object", "adjust the timing", "accept the warning after visual review"],
        ),
      );
    }
  }
  return {
    diagnostics,
    stats: {
      frames,
      objects: experience.scenes.reduce(
        (total, scene) => total + visualObjects(scene.nodes).length,
        0,
      ),
      timedProperties: experience.scenes.reduce(
        (total, scene) =>
          total + walkNodes(scene.nodes).length * 5 + visualObjects(scene.nodes).length * 3,
        0,
      ),
      invalidTransforms,
    },
  };
}
