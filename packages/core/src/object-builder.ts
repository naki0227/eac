import type { AppearanceIR, GeometryIR, ObjectIR, PropertyMap } from "@eac/ir";
import { TransformBuilder } from "./transform-builder.js";

export class ObjectBuilder extends TransformBuilder<ObjectIR> {
  constructor(
    id: string,
    geometry: GeometryIR,
    appearance: AppearanceIR,
    properties: PropertyMap,
    sourceOrder: number,
  ) {
    super({
      kind: "object",
      id,
      geometry,
      appearance,
      properties,
      dependencies: [],
      unsupportedProperties: [],
      sourceOrder,
    });
  }
}

export type { FollowPathOptions, MoveOptions, ScaleInput } from "./transform-builder.js";
