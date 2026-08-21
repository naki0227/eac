import { evaluateTimedProperty, type ExperienceIR, type ObjectIR } from "@eac/ir";

const escapeXml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
const number = (value: number): string => Number(value.toFixed(6)).toString();

function geometry(object: ObjectIR): string {
  const fill = escapeXml(object.appearance.fill);
  const stroke =
    object.appearance.stroke === undefined ? "none" : escapeXml(object.appearance.stroke);
  const shape = object.geometry;
  if (shape.kind === "rect")
    return `<rect x="${number(-shape.width.value / 2)}" y="${number(-shape.height.value / 2)}" width="${number(shape.width.value)}" height="${number(shape.height.value)}" rx="${number(shape.cornerRadius.value)}" fill="${fill}" stroke="${stroke}"/>`;
  if (shape.kind === "circle")
    return `<circle cx="0" cy="0" r="${number(shape.radius.value)}" fill="${fill}" stroke="${stroke}"/>`;
  if (shape.kind === "text")
    return `<text x="0" y="0" font-size="${number(shape.fontSize.value)}" fill="${fill}" stroke="${stroke}">${escapeXml(shape.text)}</text>`;
  const points = shape.points
    .map((point) => `${number(point.x.value)},${number(point.y.value)}`)
    .join(" ");
  return `<${shape.closed ? "polygon" : "polyline"} points="${points}" fill="${shape.closed ? fill : "none"}" stroke="${stroke}" stroke-width="${number(shape.strokeWidth.value)}"/>`;
}

function renderObject(object: ObjectIR, time: number): string {
  const position = evaluateTimedProperty(object.properties.position, time);
  const rotation = evaluateTimedProperty(object.properties.rotation, time);
  const alpha = evaluateTimedProperty(object.properties.opacity, time);
  const z = evaluateTimedProperty(object.properties.depth, time);
  const scale = Math.max(0.1, 1 + z.value / 1_000);
  return `<g id="${escapeXml(object.id)}" transform="translate(${number(position.x.value)} ${number(position.y.value)}) rotate(${number(rotation.value)}) scale(${number(scale)})" opacity="${number(alpha.value)}">${geometry(object)}</g>`;
}

export function renderSvg(experience: ExperienceIR, time: number): string {
  const activeObjects = experience.scenes.flatMap((scene) => {
    if (time < scene.start.value || time > scene.start.value + scene.duration.value) return [];
    const localTime = time - scene.start.value;
    return scene.objects.map((object) => ({ object, localTime, sceneStart: scene.start.value }));
  });
  activeObjects.sort((a, b) => {
    const depthDifference =
      evaluateTimedProperty(a.object.properties.depth, a.localTime).value -
      evaluateTimedProperty(b.object.properties.depth, b.localTime).value;
    return (
      depthDifference ||
      a.sceneStart - b.sceneStart ||
      a.object.sourceOrder - b.object.sourceOrder ||
      a.object.id.localeCompare(b.object.id)
    );
  });
  const body = activeObjects
    .map(({ object, localTime }) => renderObject(object, localTime))
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${number(experience.canvas.width.value)}" height="${number(experience.canvas.height.value)}" viewBox="0 0 ${number(experience.canvas.width.value)} ${number(experience.canvas.height.value)}">${body}</svg>`;
}
