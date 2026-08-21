import type { ApiDoc } from "./docs.js";

export const v03Docs: readonly ApiDoc[] = [
  {
    name: "reactive",
    summary: "Explains value = f(time, signals) and how reactive differs from timed.",
    signature: "scene.bind(node, { property: expression })",
    example: "scene.bind(card, { scale: when(hover(card), 1.05, 1) })",
    keywords: ["reactive", "interactive", "bind", "binding", "signal", "property", "input"],
  },
  {
    name: "signals",
    summary: "Lists the built-in signal registry that reactive expressions may read.",
    signature:
      "pointer.x | pointer.y | pointer.down | pointer.present | scroll.x | scroll.y | viewport.width | viewport.height | key(code) | hover(node) | pressed(node) | state.value",
    example: "clamp(sub(1, div(scroll.y, 300)))",
    keywords: ["signal", "signals", "pointer", "scroll", "viewport", "key", "registry", "input"],
  },
  {
    name: "state",
    summary: "Declares serializable named state that event rules write and bindings read.",
    signature: "const open = scene.state(name, initialBooleanOrNumber)",
    example:
      'const open = scene.state("open", false); scene.bind(panel, { opacity: when(open.value, 1, 0) })',
    keywords: ["state", "boolean", "number", "toggle", "set", "declare", "application"],
  },
  {
    name: "hover",
    summary: "A boolean signal derived by hit-testing the pointer against node geometry.",
    signature: "hover(node)",
    example: "scene.bind(card, { scale: when(hover(card), 1.05, 1) })",
    keywords: ["hover", "pointer", "over", "enter", "leave", "hit", "geometry"],
  },
  {
    name: "click",
    summary: "Fires when pointer down and pointer up resolve to the same hit target.",
    signature: "scene.on(onClick(node), toggle(state))",
    example: "scene.on(onClick(button), toggle(expanded))",
    keywords: ["click", "press", "tap", "button", "rule", "trigger", "event"],
  },
  {
    name: "keyboard",
    summary: "Global key signals and key triggers; v0.3 has no focus model.",
    signature: "key(code) | onKeyDown(code) | onKeyUp(code)",
    example: 'scene.on(onKeyDown("ArrowRight"), setState(offset, add(offset.value, 40)))',
    keywords: ["keyboard", "key", "keydown", "keyup", "arrow", "escape", "space", "focus"],
  },
  {
    name: "scroll",
    summary: "Explicit scroll offsets supplied by input; not a browser scroll container.",
    signature: "scroll.x | scroll.y | onScroll()",
    example: "scene.bind(header, { opacity: clamp(sub(1, div(scroll.y, 300))) })",
    keywords: ["scroll", "wheel", "parallax", "offset", "header", "signal"],
  },
  {
    name: "expression",
    summary: "The closed reactive vocabulary; every helper builds inspectable IR, never a closure.",
    signature:
      "when | clamp | lerp | add | sub | mul | div | min | max | neg | equals | lessThan | greaterThan | atLeast | atMost | and | or | not",
    example: "when(and(hover(card), not(open.value)), 1.05, 1)",
    keywords: ["expression", "derive", "map", "combine", "when", "clamp", "lerp", "arithmetic"],
  },
  {
    name: "scenario",
    summary: "A serializable, replayable trace of timestamped input events and assertions.",
    signature: "scenario(name, { duration }, (input) => { input.pointerMove(at, x, y) })",
    example: "eac check scene.mjs --scenario trace.eac-scenario.json",
    keywords: ["scenario", "trace", "input", "events", "assert", "fixture", "test"],
  },
  {
    name: "replay",
    summary:
      "Deterministic replay of a scenario; reactive is replayable, timed is directly seekable.",
    signature: "eac render scene.mjs --scenario trace.eac-scenario.json",
    example: "eac preview scene.mjs --scenario trace.eac-scenario.json",
    keywords: ["replay", "deterministic", "seek", "reproduce", "video", "render"],
  },
  {
    name: "recording",
    summary: "Records normalized preview input and exports it as a scenario file.",
    signature: "eac preview scene.mjs → Record → Stop → Export scenario",
    example: "eac preview examples/click-toggle/eac.config.mjs --output preview.html",
    keywords: ["record", "recording", "capture", "export", "preview", "scenario"],
  },
  {
    name: "hit-testing",
    summary: "Resolves the frontmost interactive node under a point in node-local space.",
    signature: "topmost by world depth, then declaration order, then node id",
    example: 'scene.rect("backdrop", { ..., interactive: false })',
    keywords: ["hit", "hittest", "target", "topmost", "depth", "interactive", "pointer"],
  },
  {
    name: "event-order",
    summary: "The per-step phase model: freeze geometry, apply input, hit-test, rules, commit.",
    signature: "tick and event steps sorted by (time, rank, order)",
    example: "eac docs event-order",
    keywords: ["order", "phase", "frame", "step", "tick", "sequence", "semantics", "stability"],
  },
  {
    name: "reactive-writers",
    summary: "One writer per property: timed or reactive, never both.",
    signature: "eac::reactive::mixed-property-writers",
    example: "remove the fadeTo, or remove the opacity binding",
    keywords: ["writer", "conflict", "mixed", "single", "property", "timed", "reactive"],
  },
];
