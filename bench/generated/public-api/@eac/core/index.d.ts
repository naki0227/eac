export { experience, ExperienceBuilder, SceneBuilder, type AudioOptions } from "./builders.js";
export { GroupBuilder } from "./group-builder.js";
export { TransformBuilder } from "./transform-builder.js";
export type { ImageStyle, ObjectStyle, TransformStyle } from "./node-factory.js";
export { asset } from "./asset.js";
export {
  ObjectBuilder,
  type FollowPathOptions,
  type MoveOptions,
  type ScaleInput,
} from "./object-builder.js";
export type { MotionOptions, RelativeMotionOptions } from "./motion-normalizer.js";
export { easing } from "./easing.js";
export { trajectory } from "./trajectory.js";
export { delay, motion, parallel, schedule, sequence, stagger } from "./motion-plan.js";
export type { MotionPlan } from "./motion-plan.js";
export { presets } from "./presets.js";
export {
  add,
  and,
  atLeast,
  atMost,
  clamp,
  div,
  equals,
  expr,
  greaterThan,
  hover,
  key,
  lerp,
  lessThan,
  max,
  min,
  mul,
  neg,
  not,
  notEquals,
  or,
  pointer,
  pressed,
  scroll,
  sub,
  viewport,
  when,
} from "./reactive.js";
export type { ExprInput } from "./reactive.js";
export {
  ReactiveScene,
  onClick,
  onKeyDown,
  onKeyUp,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
  onPointerUp,
  onScroll,
  playSound,
  setState,
  toggle,
} from "./reactive-scene.js";
export type { BindingInput, SoundHandle, SoundOptions, StateHandle } from "./reactive-scene.js";
export { scenario, parseScenario, ScenarioBuilder } from "./scenario.js";
export { hex, normalizeColor, rgb, rgba } from "./color.js";
export type { ColorInput } from "./color.js";
export { deg, depth, ms, opacity, px, rad, sec } from "@eac/units";
export type {
  EventActionIR,
  EventRuleIR,
  EventTriggerIR,
  ReactiveBindingIR,
  ReactiveExpr,
  ReactiveSceneIR,
  ScenarioEventIR,
  ScenarioEventPayload,
  ScenarioIR,
  SignalRef,
  SignalValue,
  StateDeclIR,
  AssetIR,
  AudioAssetIR,
  AudioClipIR,
  ColorIR,
  Easing,
  ExperienceIR,
  MoveTrajectory,
  PathTrajectory,
  Scale2,
  Trajectory,
  Vec2,
} from "@eac/ir";
//# sourceMappingURL=index.d.ts.map
