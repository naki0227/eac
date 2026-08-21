import { evaluateTimedProperty, type ExperienceIR, type GeometryIR, type ObjectIR } from "@eac/ir";
import { warning, type Diagnostic } from "./diagnostic.js";

type Box = Readonly<{ left: number; top: number; right: number; bottom: number }>;

function bounds(object: ObjectIR, time: number): Box {
  const position = evaluateTimedProperty(object.properties.position, time);
  const geometry: GeometryIR = object.geometry;
  if (geometry.kind === "rect")
    return {
      left: position.x.value - geometry.width.value / 2,
      top: position.y.value - geometry.height.value / 2,
      right: position.x.value + geometry.width.value / 2,
      bottom: position.y.value + geometry.height.value / 2,
    };
  if (geometry.kind === "circle")
    return {
      left: position.x.value - geometry.radius.value,
      top: position.y.value - geometry.radius.value,
      right: position.x.value + geometry.radius.value,
      bottom: position.y.value + geometry.radius.value,
    };
  if (geometry.kind === "text") {
    const width = geometry.width?.value ?? geometry.text.length * geometry.fontSize.value * 0.6;
    return {
      left: position.x.value,
      top: position.y.value - geometry.fontSize.value,
      right: position.x.value + width,
      bottom: position.y.value,
    };
  }
  const xs = geometry.points.map((point) => point.x.value + position.x.value);
  const ys = geometry.points.map((point) => point.y.value + position.y.value);
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
      for (const object of scene.objects) {
        const values = [
          evaluateTimedProperty(object.properties.position, time),
          evaluateTimedProperty(object.properties.rotation, time),
          evaluateTimedProperty(object.properties.opacity, time),
          evaluateTimedProperty(object.properties.depth, time),
        ];
        const serialized = JSON.stringify(values);
        if (serialized.includes("null")) invalidTransforms++;
      }
      for (let index = 0; index < scene.objects.length; index++)
        for (let otherIndex = index + 1; otherIndex < scene.objects.length; otherIndex++) {
          const first = scene.objects[index];
          const second = scene.objects[otherIndex];
          if (!first || !second || !intersects(bounds(first, time), bounds(second, time))) continue;
          const key = `${first.id}\0${second.id}`;
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
      objects: experience.scenes.reduce((total, scene) => total + scene.objects.length, 0),
      timedProperties: experience.scenes.reduce(
        (total, scene) => total + scene.objects.length * 4,
        0,
      ),
      invalidTransforms,
    },
  };
}
