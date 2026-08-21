import { apiDocs, type ApiCategory, type ApiDoc } from "./docs.js";

const categories: Readonly<Record<ApiCategory, ReadonlySet<string>>> = {
  Primitives: new Set(["experience", "scene", "group", "rect", "circle", "text", "path"]),
  Motion: new Set([
    "moveTo",
    "moveBy",
    "followPath",
    "rotateTo",
    "rotateBy",
    "scaleTo",
    "scaleBy",
    "fadeTo",
    "depthTo",
    "depthBy",
    "bringForward",
    "easing",
  ]),
  Composition: new Set([
    "motion",
    "sequence",
    "parallel",
    "delay",
    "stagger",
    "schedule",
    "presets",
  ]),
  Trajectory: new Set(["trajectory", "bezier", "cycloid", "ellipse", "orbit", "spiral", "wave"]),
  Styling: new Set(["color", "styling", "colorTo", "strokeColorTo", "blurTo"]),
  Assets: new Set(["asset", "image"]),
  Audio: new Set(["audio"]),
  Reactive: new Set(["reactive", "signals", "state", "expression", "reactive-writers"]),
  Interaction: new Set(["hover", "click", "keyboard", "scroll", "hit-testing", "event-order"]),
  Scenario: new Set(["scenario", "replay", "recording"]),
  Units: new Set(["units"]),
  Validation: new Set(["inspect", "check", "preview"]),
};

export function categoryForDoc(doc: ApiDoc): ApiCategory {
  for (const [category, names] of Object.entries(categories) as [
    ApiCategory,
    ReadonlySet<string>,
  ][]) {
    if (names.has(doc.name)) return category;
  }
  return "Primitives";
}

export function categorizeDocs(): ReadonlyMap<ApiCategory, readonly ApiDoc[]> {
  const grouped = new Map<ApiCategory, ApiDoc[]>();
  for (const doc of apiDocs) {
    const category = categoryForDoc(doc);
    grouped.set(category, [...(grouped.get(category) ?? []), doc]);
  }
  return grouped;
}

const tokenize = (value: string): string[] =>
  (value.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((token) => token.length > 1);

export function searchDocs(query: string): readonly ApiDoc[] {
  const tokens = tokenize(query);
  return apiDocs
    .map((doc, index) => {
      const name = doc.name.toLowerCase();
      const haystack = [name, categoryForDoc(doc), doc.summary, ...doc.keywords]
        .join(" ")
        .toLowerCase();
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
  return `${doc.name}\n\nCategory: ${categoryForDoc(doc)}\n\n${doc.summary}\n\nSignature:\n${doc.signature}\n\nExample:\n${doc.example}`;
}
