export type ApiDoc = Readonly<{
  name: string;
  summary: string;
  signature: string;
  example: string;
  keywords: readonly string[];
}>;

export const apiDocs: readonly ApiDoc[] = [
  {
    name: "experience",
    summary: "Creates an Experience builder with canvas, duration, and FPS.",
    signature: "experience({ name, width, height, duration, fps? })",
    example: 'experience({ name: "demo", width: px(1280), height: px(720), duration: sec(5) })',
    keywords: ["project", "canvas", "duration", "create"],
  },
  {
    name: "scene",
    summary: "Adds a scene with a global start and duration.",
    signature: "project.scene(id, { at?, duration? })",
    example: 'project.scene("main", { at: sec(0), duration: sec(5) })',
    keywords: ["timeline", "structure", "section"],
  },
  {
    name: "rect",
    summary: "Creates a rectangle with a centered position.",
    signature: "scene.rect(id, { position, width, height, fill, ... })",
    example:
      'scene.rect("card", { position: { x: px(200), y: px(100) }, width: px(240), height: px(120), fill: "#222" })',
    keywords: ["rectangle", "box", "card", "shape"],
  },
  {
    name: "circle",
    summary: "Creates a circle with a centered position.",
    signature: "scene.circle(id, { position, radius, fill, ... })",
    example:
      'scene.circle("dot", { position: { x: px(50), y: px(50) }, radius: px(12), fill: "red" })',
    keywords: ["round", "dot", "shape"],
  },
  {
    name: "text",
    summary: "Creates text using approximate bounds for checking.",
    signature: "scene.text(id, text, { position, fontSize, fill, width? })",
    example:
      'scene.text("title", "Hello", { position: { x: px(80), y: px(100) }, fontSize: px(48), fill: "white" })',
    keywords: ["label", "title", "copy", "typography"],
  },
  {
    name: "path",
    summary: "Creates a polyline or closed polygon from points.",
    signature: "scene.path(id, points, { position, closed?, strokeWidth?, fill, stroke? })",
    example:
      'scene.path("line", [{ x: px(0), y: px(0) }, { x: px(100), y: px(50) }], { position: { x: px(10), y: px(10) }, fill: "none", stroke: "white" })',
    keywords: ["geometry", "line", "polygon", "points"],
  },
  {
    name: "moveTo",
    summary: "Moves position from its value at `at` to a target position.",
    signature: "object.moveTo(target, { at, duration, trajectory? })",
    example: "dot.moveTo({ x: px(400), y: px(200) }, { at: sec(1), duration: sec(2) })",
    keywords: ["move", "position", "animate", "motion", "linear"],
  },
  {
    name: "moveBy",
    summary: "Moves by an offset from the position evaluated at `at`.",
    signature: "object.moveBy(delta, { at, duration, easing? })",
    example: "dot.moveBy({ x: px(120), y: px(-20) }, { at: sec(1), duration: sec(0.8) })",
    keywords: ["move", "relative", "offset", "position", "motion"],
  },
  {
    name: "bezier",
    summary: "Uses a cubic Bézier trajectory for moveTo.",
    signature: 'trajectory: { kind: "bezier", control1, control2 }',
    example:
      'dot.moveTo(target, { at: sec(0), duration: sec(2), trajectory: { kind: "bezier", control1, control2 } })',
    keywords: ["curve", "cubic", "path", "control point"],
  },
  {
    name: "cycloid",
    summary: "Uses a deterministic cycloid trajectory for moveTo.",
    signature: 'trajectory: { kind: "cycloid", radius, turns? }',
    example:
      'dot.moveTo(target, { at: sec(0), duration: sec(2), trajectory: { kind: "cycloid", radius: px(30) } })',
    keywords: ["cycloid", "roll", "wheel", "curve", "path", "move along"],
  },
  {
    name: "followPath",
    summary: "Moves position along one absolute deterministic path writer.",
    signature: "object.followPath(path, { at, duration, easing? })",
    example:
      "dot.followPath(trajectory.orbit({ center, radius: px(80) }), { at: sec(1), duration: sec(2) })",
    keywords: ["follow", "path", "trajectory", "position", "orbit", "spiral", "wave"],
  },
  {
    name: "ellipse",
    summary:
      "Creates an absolute elliptical arc with explicit center, radii, angles, and rotation.",
    signature:
      "trajectory.ellipse({ center, radiusX, radiusY, rotation?, startAngle?, endAngle? })",
    example:
      "trajectory.ellipse({ center, radiusX: px(120), radiusY: px(60), startAngle: deg(0), endAngle: deg(180) })",
    keywords: ["ellipse", "arc", "path", "trajectory", "follow"],
  },
  {
    name: "orbit",
    summary: "Creates a circular absolute orbit with a start angle and positive turn count.",
    signature: "trajectory.orbit({ center, radius, startAngle?, turns? })",
    example: "trajectory.orbit({ center, radius: px(100), turns: 2 })",
    keywords: ["orbit", "circle", "path", "trajectory", "follow"],
  },
  {
    name: "spiral",
    summary: "Creates an absolute spiral by interpolating radius and angle.",
    signature: "trajectory.spiral({ center, startRadius, endRadius, turns?, startAngle? })",
    example: "trajectory.spiral({ center, startRadius: px(10), endRadius: px(120), turns: 2 })",
    keywords: ["spiral", "radius", "path", "trajectory", "follow"],
  },
  {
    name: "wave",
    summary: "Creates a sine wave perpendicular to a non-degenerate start/end baseline.",
    signature: "trajectory.wave({ start, end, amplitude, cycles?, phase? })",
    example: "trajectory.wave({ start, end, amplitude: px(24), cycles: 3 })",
    keywords: ["wave", "sine", "path", "trajectory", "follow"],
  },
  {
    name: "rotateTo",
    summary: "Rotates from the angle at `at` to a target angle.",
    signature: "object.rotateTo(angle, { at, duration })",
    example: "dot.rotateTo(deg(180), { at: sec(1), duration: sec(2) })",
    keywords: ["rotate", "angle", "spin", "turn"],
  },
  {
    name: "rotateBy",
    summary: "Rotates by an angle from the rotation evaluated at `at`.",
    signature: "object.rotateBy(angle, { at, duration, easing? })",
    example: "dot.rotateBy(deg(90), { at: sec(1), duration: sec(0.5) })",
    keywords: ["rotate", "relative", "angle", "spin", "turn"],
  },
  {
    name: "scaleTo",
    summary: "Scales uniformly or per axis to an absolute target.",
    signature: "object.scaleTo(number | { x, y }, { at, duration, easing? })",
    example: "dot.scaleTo(1.2, { at: sec(1), duration: sec(0.4) })",
    keywords: ["scale", "resize", "transform", "absolute"],
  },
  {
    name: "scaleBy",
    summary: "Adds a scale delta to the scale evaluated at `at`.",
    signature: "object.scaleBy(number | { x, y }, { at, duration, easing? })",
    example: "dot.scaleBy(0.2, { at: sec(2), duration: sec(0.3) })",
    keywords: ["scale", "relative", "resize", "transform"],
  },
  {
    name: "fadeTo",
    summary: "Interpolates opacity to a value from 0 to 1.",
    signature: "object.fadeTo(opacity, { at, duration })",
    example: "dot.fadeTo(opacity(0), { at: sec(3), duration: sec(1) })",
    keywords: ["fade", "opacity", "transparent", "appear", "disappear"],
  },
  {
    name: "depthTo",
    summary: "Moves an object along the 2.5D depth axis.",
    signature: "object.depthTo(depth, { at, duration })",
    example: "dot.depthTo(depth(100), { at: sec(1), duration: sec(2) })",
    keywords: ["depth", "z", "front", "back", "layer"],
  },
  {
    name: "depthBy",
    summary: "Moves by a depth offset from the depth evaluated at `at`.",
    signature: "object.depthBy(delta, { at, duration, easing? })",
    example: "dot.depthBy(depth(20), { at: sec(1), duration: sec(0.5) })",
    keywords: ["depth", "relative", "z", "front", "back", "layer"],
  },
  {
    name: "easing",
    summary: "Provides deterministic linear, ease-in/out, and cubic Bézier timing curves.",
    signature:
      "easing.linear | easing.easeIn | easing.easeOut | easing.easeInOut | easing.cubicBezier(x1, y1, x2, y2)",
    example: "dot.moveTo(target, { at: sec(1), duration: sec(0.8), easing: easing.easeOut })",
    keywords: ["easing", "timing", "curve", "cubic bezier", "animation"],
  },
  {
    name: "bringForward",
    summary: "Semantic depthTo primitive that brings an object forward.",
    signature: "object.bringForward({ at, duration, to })",
    example: "dot.bringForward({ at: sec(1), duration: sec(2), to: depth(100) })",
    keywords: ["front", "forward", "z order", "layer", "depth"],
  },
];

const tokenize = (value: string): string[] =>
  (value.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((token) => token.length > 1);

export function searchDocs(query: string): readonly ApiDoc[] {
  const tokens = tokenize(query);
  return apiDocs
    .map((doc, index) => {
      const name = doc.name.toLowerCase();
      const haystack = [name, doc.summary, ...doc.keywords].join(" ").toLowerCase();
      const score = tokens.reduce(
        (total, token) =>
          total +
          (name === token ? 10 : name.includes(token) ? 5 : haystack.includes(token) ? 1 : 0),
        0,
      );
      return { doc, score, index };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 5)
    .map((result) => result.doc);
}

export function formatApiDoc(doc: ApiDoc): string {
  return `${doc.name}\n\n${doc.summary}\n\nSignature:\n${doc.signature}\n\nExample:\n${doc.example}`;
}
