import {
  compareSourcePaths,
  evaluateScene,
  type EvaluatedObject,
  type ColorIR,
  type ExperienceIR,
} from "@eac/ir";

const escapeXml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
const number = (value: number): string => Number(value.toFixed(6)).toString();

const color = (value: ColorIR): string =>
  `#${[value.red, value.green, value.blue]
    .map((channel) =>
      Math.round(channel * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;

function geometry(evaluated: EvaluatedObject): string {
  const { object, appearance } = evaluated;
  const fill = color(appearance.fill);
  const stroke = color(appearance.stroke);
  const shape = object.geometry;
  if (shape.kind === "rect")
    return `<rect x="${number(-shape.width.value / 2)}" y="${number(-shape.height.value / 2)}" width="${number(shape.width.value)}" height="${number(shape.height.value)}" rx="${number(shape.cornerRadius.value)}" fill="${fill}" fill-opacity="${number(appearance.fill.alpha)}" stroke="${stroke}" stroke-opacity="${number(appearance.stroke.alpha)}" stroke-width="${number(appearance.strokeWidth)}"/>`;
  if (shape.kind === "circle")
    return `<circle cx="0" cy="0" r="${number(shape.radius.value)}" fill="${fill}" fill-opacity="${number(appearance.fill.alpha)}" stroke="${stroke}" stroke-opacity="${number(appearance.stroke.alpha)}" stroke-width="${number(appearance.strokeWidth)}"/>`;
  if (shape.kind === "text")
    return `<text x="0" y="0" font-size="${number(shape.fontSize.value)}" font-family="${escapeXml(shape.fontFamily)}" font-weight="${number(shape.fontWeight)}" text-anchor="${shape.textAlign}" letter-spacing="${number(shape.letterSpacing.value)}" fill="${fill}" fill-opacity="${number(appearance.fill.alpha)}" stroke="${stroke}" stroke-opacity="${number(appearance.stroke.alpha)}" stroke-width="${number(appearance.strokeWidth)}">${escapeXml(shape.text)}</text>`;
  if (shape.kind === "image") {
    if (shape.asset.kind !== "embedded")
      throw new TypeError(`Image asset \`${shape.asset.path}\` is not renderable.`);
    const aspectRatio =
      shape.fit === "fill" ? "none" : shape.fit === "cover" ? "xMidYMid slice" : "xMidYMid meet";
    return `<image x="${number(-shape.width.value / 2)}" y="${number(-shape.height.value / 2)}" width="${number(shape.width.value)}" height="${number(shape.height.value)}" preserveAspectRatio="${aspectRatio}" href="data:${shape.asset.mimeType};base64,${shape.asset.data}"/>`;
  }
  const points = shape.points
    .map((point) => `${number(point.x.value)},${number(point.y.value)}`)
    .join(" ");
  return `<${shape.closed ? "polygon" : "polyline"} points="${points}" fill="${shape.closed ? fill : "none"}" fill-opacity="${number(appearance.fill.alpha)}" stroke="${stroke}" stroke-opacity="${number(appearance.stroke.alpha)}" stroke-width="${number(appearance.strokeWidth)}"/>`;
}

function filterDefinition(evaluated: EvaluatedObject, id: string): string {
  const { blur, shadow } = evaluated.appearance;
  if (blur <= 0 && shadow === undefined) return "";
  const content =
    blur > 0
      ? `<feGaussianBlur in="SourceGraphic" stdDeviation="${number(blur)}" result="content"/>`
      : "";
  const primitives =
    shadow === undefined
      ? content
      : `<feGaussianBlur in="SourceAlpha" stdDeviation="${number(shadow.blur.value)}" result="shadow-blur"/><feOffset in="shadow-blur" dx="${number(shadow.offsetX.value)}" dy="${number(shadow.offsetY.value)}" result="shadow-offset"/><feFlood flood-color="${color(shadow.color)}" flood-opacity="${number(shadow.color.alpha)}" result="shadow-color"/><feComposite in="shadow-color" in2="shadow-offset" operator="in" result="shadow"/>${content}<feMerge><feMergeNode in="shadow"/><feMergeNode in="${blur > 0 ? "content" : "SourceGraphic"}"/></feMerge>`;
  return `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%">${primitives}</filter>`;
}

function renderObject(evaluated: EvaluatedObject, filterId: string): string {
  const { object, matrix, opacity, depth } = evaluated;
  const depthScale = Math.max(0.1, 1 + depth / 1_000);
  const transformed = [
    matrix[0] * depthScale,
    matrix[1] * depthScale,
    matrix[2] * depthScale,
    matrix[3] * depthScale,
    matrix[4],
    matrix[5],
  ];
  const filter =
    evaluated.appearance.blur > 0 || evaluated.appearance.shadow !== undefined
      ? ` filter="url(#${filterId})"`
      : "";
  return `<g id="${escapeXml(object.id)}" transform="matrix(${transformed.map(number).join(" ")})" opacity="${number(opacity)}"${filter}>${geometry(evaluated)}</g>`;
}

export function renderSvg(experience: ExperienceIR, time: number): string {
  const activeObjects = experience.scenes.flatMap((scene) => {
    if (time < scene.start.value || time > scene.start.value + scene.duration.value) return [];
    const localTime = time - scene.start.value;
    return evaluateScene(scene, localTime).map((evaluated) => ({
      evaluated,
      sceneStart: scene.start.value,
    }));
  });
  activeObjects.sort((a, b) => {
    const depthDifference = a.evaluated.depth - b.evaluated.depth;
    return (
      depthDifference ||
      a.sceneStart - b.sceneStart ||
      compareSourcePaths(a.evaluated.sourcePath, b.evaluated.sourcePath) ||
      a.evaluated.object.id.localeCompare(b.evaluated.object.id)
    );
  });
  const filters = activeObjects
    .map(({ evaluated }, index) => filterDefinition(evaluated, `eac-filter-${index}`))
    .join("");
  const body = activeObjects
    .map(({ evaluated }, index) => renderObject(evaluated, `eac-filter-${index}`))
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${number(experience.canvas.width.value)}" height="${number(experience.canvas.height.value)}" viewBox="0 0 ${number(experience.canvas.width.value)} ${number(experience.canvas.height.value)}">${filters ? `<defs>${filters}</defs>` : ""}${body}</svg>`;
}
