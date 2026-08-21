import type { AppearanceIR, ColorIR, GeometryIR, ObjectIR, PropertyMap } from "@eac/ir";
import type { Length } from "@eac/units";
import { type ColorInput } from "./color.js";
import { type MotionOptions } from "./motion-normalizer.js";
import { TransformBuilder } from "./transform-builder.js";
export declare class ObjectBuilder extends TransformBuilder<ObjectIR> {
  #private;
  constructor(
    id: string,
    geometry: GeometryIR,
    appearance: AppearanceIR,
    properties: PropertyMap,
    sourceOrder: number,
  );
  colorTo(target: ColorInput, options: MotionOptions<ColorIR>): this;
  strokeColorTo(target: ColorInput, options: MotionOptions<ColorIR>): this;
  blurTo(target: Length, options: MotionOptions<Length>): this;
}
export type { FollowPathOptions, MoveOptions, ScaleInput } from "./transform-builder.js";
//# sourceMappingURL=object-builder.d.ts.map
