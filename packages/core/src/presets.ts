import type { Easing, TransformNodeIR } from "@eac/ir";
import { opacity, px, type Length, type Time } from "@eac/units";
import { motion, parallel, type MotionPlan } from "./motion-plan.js";
import type { TransformBuilder } from "./transform-builder.js";

type Target = TransformBuilder<TransformNodeIR>;
type PresetOptions = Readonly<{ duration: Time; easing?: Easing }>;

export const presets = Object.freeze({
  fadeIn(target: Target, options: PresetOptions): MotionPlan {
    return motion.fadeTo(target, opacity(1), options);
  },
  fadeOut(target: Target, options: PresetOptions): MotionPlan {
    return motion.fadeTo(target, opacity(0), options);
  },
  popIn(target: Target, options: PresetOptions): MotionPlan {
    return parallel(motion.fadeTo(target, opacity(1), options), motion.scaleTo(target, 1, options));
  },
  riseIn(target: Target, options: PresetOptions & Readonly<{ distance?: Length }>): MotionPlan {
    const distance = options.distance ?? px(24);
    return parallel(
      motion.fadeTo(target, opacity(1), options),
      motion.moveBy(target, { x: px(0), y: px(-distance.value) }, options),
    );
  },
});
