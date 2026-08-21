/**
 * The browser preview's entry point. It exposes the shared semantic runtime and the SVG renderer —
 * nothing else. There is no reactive evaluation in this file and none in the preview page: the
 * browser drives the same `LiveSession` and `ExperienceSession` that the checker, inspector, and
 * renderer use.
 */
export { ExperienceSession, LiveSession } from "@eac/runtime";
export {
  PointerCoalescer,
  isInsideCanvas,
  keyDown,
  keyUp,
  normalizeKey,
  pointerDown,
  pointerLeave,
  pointerMove,
  pointerUp,
  scrollTo,
  toScenePoint,
} from "@eac/runtime/browser";
export { renderSvg } from "@eac/renderer-svg/svg";
export { reviveExperience, reviveScenario, scenarioToJson } from "./revive.js";
