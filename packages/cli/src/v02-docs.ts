import type { ApiDoc } from "./docs.js";

export const v02Docs: readonly ApiDoc[] = [
  {
    name: "trajectory",
    summary: "Creates deterministic paths for followPath or trajectory options for moveTo.",
    signature: "trajectory.ellipse(...) | orbit(...) | spiral(...) | wave(...) | linear",
    example: "eac docs spiral",
    keywords: ["trajectory", "path", "ellipse", "orbit", "spiral", "wave", "bezier", "cycloid"],
  },
  {
    name: "colorTo",
    summary: "Animates fill color using deterministic normalized sRGB channel interpolation.",
    signature: "object.colorTo(color, { at, duration, easing? })",
    example: 'card.colorTo(hex("#38bdf8"), { at: sec(1), duration: sec(0.5) })',
    keywords: ["fill", "color", "animate", "srgb", "style"],
  },
  {
    name: "strokeColorTo",
    summary: "Animates stroke color without replacing the fill writer.",
    signature: "object.strokeColorTo(color, { at, duration, easing? })",
    example: 'card.strokeColorTo(hex("#ffffff"), { at: sec(1), duration: sec(0.5) })',
    keywords: ["stroke", "outline", "color", "animate", "style"],
  },
  {
    name: "blurTo",
    summary: "Animates a non-negative SVG-rendered blur radius.",
    signature: "object.blurTo(length, { at, duration, easing? })",
    example: "card.blurTo(px(4), { at: sec(1), duration: sec(0.4) })",
    keywords: ["blur", "filter", "style", "animate", "soften"],
  },
  {
    name: "units",
    summary: "Creates explicit length, time, angle, opacity, and depth values.",
    signature:
      "px(value) | sec(value) | ms(value) | deg(value) | rad(value) | opacity(value) | depth(value)",
    example: "{ x: px(100), at: sec(1), rotation: deg(45), opacity: opacity(0.8) }",
    keywords: ["units", "px", "seconds", "milliseconds", "degrees", "radians", "opacity", "depth"],
  },
  {
    name: "inspect",
    summary: "Prints the node tree, normalized writers, assets, counts, and validation summary.",
    signature: "eac inspect [project] [--json]",
    example: "eac inspect eac.config.mjs --json",
    keywords: ["inspect", "tree", "writers", "json", "assets", "debug", "validation"],
  },
  {
    name: "check",
    summary: "Runs static rules and the deterministic frame harness with actionable diagnostics.",
    signature: "eac check [project] [--ci]",
    example: "eac check eac.config.mjs --ci",
    keywords: ["check", "validate", "diagnostic", "errors", "warnings", "ci", "conflict"],
  },
  {
    name: "preview",
    summary: "Writes an interactive HTML timeline with seek, stepping, time, and playback speed.",
    signature: "eac preview [project] [--output preview.html]",
    example: "eac preview eac.config.mjs --output preview.html",
    keywords: ["preview", "play", "pause", "seek", "step", "speed", "timeline"],
  },
];
