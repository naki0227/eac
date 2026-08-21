import { assetDocs } from "./asset-docs.js";
import { v02Docs } from "./v02-docs.js";
import { v03Docs } from "./v03-docs.js";

export type ApiDoc = Readonly<{
  name: string;
  summary: string;
  signature: string;
  example: string;
  keywords: readonly string[];
}>;

export type ApiCategory =
  | "Primitives"
  | "Motion"
  | "Composition"
  | "Trajectory"
  | "Styling"
  | "Assets"
  | "Audio"
  | "Reactive"
  | "Interaction"
  | "Scenario"
  | "Units"
  | "Validation";

const baseApiDocs: readonly ApiDoc[] = [
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
    name: "group",
    summary: "Creates a transformable parent whose children keep local coordinates.",
    signature: "scene.group(id, { position?, rotation?, scale?, opacity?, depth? })",
    example:
      'const card = scene.group("card", { position: { x: px(200), y: px(300) } }); card.rect("body", { position: { x: px(0), y: px(0) }, ... })',
    keywords: ["group", "parent", "children", "nested", "transform", "composition"],
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
    name: "motion",
    summary: "Creates an immutable atomic MotionPlan without assigning a runtime start time.",
    signature: "motion.moveTo(node, target, { duration, easing? }) and matching property helpers",
    example: "const enter = motion.fadeTo(title, opacity(1), { duration: sec(0.4) })",
    keywords: ["motion", "plan", "compose", "animation", "atomic"],
  },
  {
    name: "sequence",
    summary: "Composes MotionPlans with deterministic cumulative offsets.",
    signature: "sequence(...plans)",
    example: "schedule(sequence(enter, move, exit), { at: sec(1) })",
    keywords: ["sequence", "after", "serial", "plan", "timeline", "compose"],
  },
  {
    name: "parallel",
    summary: "Composes MotionPlans at one shared start and uses the longest duration.",
    signature: "parallel(...plans)",
    example: "schedule(parallel(move, fade), { at: sec(1) })",
    keywords: ["parallel", "together", "simultaneous", "plan", "timeline", "compose"],
  },
  {
    name: "delay",
    summary: "Creates empty plan time or shifts a MotionPlan by a fixed duration.",
    signature: "delay(duration, plan?)",
    example: "sequence(enter, delay(sec(0.5)), exit)",
    keywords: ["delay", "wait", "pause", "offset", "plan", "timeline"],
  },
  {
    name: "stagger",
    summary: "Offsets one plan per stable input index by a fixed interval.",
    signature: "stagger(items, interval, (item, index) => MotionPlan)",
    example:
      "schedule(stagger(dots, sec(0.1), (dot) => motion.fadeTo(dot, opacity(1), { duration: sec(0.3) })))",
    keywords: ["stagger", "cascade", "list", "items", "offset", "plan", "timeline"],
  },
  {
    name: "schedule",
    summary: "Lowers a MotionPlan at an explicit time into ordinary checked TimedProperty writes.",
    signature: "schedule(plan, { at? })",
    example: "schedule(plan, { at: sec(1) })",
    keywords: ["schedule", "apply", "lower", "plan", "timeline", "start"],
  },
  {
    name: "presets",
    summary:
      "Provides small fadeIn, fadeOut, popIn, and riseIn plans built from public primitives.",
    signature: "presets.fadeIn(node, options) | fadeOut | popIn | riseIn",
    example: "schedule(presets.popIn(card, { duration: sec(0.4) }), { at: sec(1) })",
    keywords: ["preset", "fade in", "fade out", "pop in", "rise in", "reusable", "plan"],
  },
  {
    name: "color",
    summary:
      "Creates normalized sRGB colors and animates fill with deterministic channel interpolation.",
    signature: "rgb(r, g, b) | rgba(r, g, b, a) | hex(value); object.colorTo(color, options)",
    example: 'card.colorTo(hex("#38bdf8"), { at: sec(1), duration: sec(0.5) })',
    keywords: ["color", "rgb", "rgba", "hex", "fill", "animate", "srgb"],
  },
  {
    name: "styling",
    summary: "Configures stroke, corner radius, blur, shadow, and deterministic text attributes.",
    signature:
      "{ stroke, strokeWidth, cornerRadius, blur, shadow, fontFamily, fontWeight, textAlign, letterSpacing }",
    example: "card.blurTo(px(4), { at: sec(1), duration: sec(0.4) })",
    keywords: ["style", "stroke", "corner", "blur", "shadow", "font", "text"],
  },
  {
    name: "bringForward",
    summary: "Semantic depthTo primitive that brings an object forward.",
    signature: "object.bringForward({ at, duration, to })",
    example: "dot.bringForward({ at: sec(1), duration: sec(2), to: depth(100) })",
    keywords: ["front", "forward", "z order", "layer", "depth"],
  },
];

export const apiDocs: readonly ApiDoc[] = [...baseApiDocs, ...assetDocs, ...v02Docs, ...v03Docs];

export { categorizeDocs, categoryForDoc, formatApiDoc, searchDocs } from "./doc-catalog.js";
