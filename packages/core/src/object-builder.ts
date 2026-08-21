import type {
  AppearanceIR,
  ColorIR,
  GeometryIR,
  ObjectIR,
  PropertyMap,
  StylePropertyMap,
  StylePropertyName,
} from "@eac/ir";
import type { Length } from "@eac/units";
import { normalizeColor, type ColorInput } from "./color.js";
import {
  normalizeAbsoluteProperty,
  type MotionOperation,
  type MotionOptions,
} from "./motion-normalizer.js";
import { TransformBuilder } from "./transform-builder.js";

export class ObjectBuilder extends TransformBuilder<ObjectIR> {
  readonly #baseStyleProperties: StylePropertyMap;
  readonly #styleOperations: {
    [K in StylePropertyName]: MotionOperation<StylePropertyMap[K]["initial"]>[];
  } = { fill: [], stroke: [], blur: [] };
  #styleMotionCount = 0;

  constructor(
    id: string,
    geometry: GeometryIR,
    appearance: AppearanceIR,
    properties: PropertyMap,
    sourceOrder: number,
  ) {
    const object: ObjectIR = {
      kind: "object",
      id,
      geometry,
      appearance,
      properties,
      dependencies: [],
      unsupportedProperties: [],
      sourceOrder,
    };
    super(object);
    this.#baseStyleProperties = appearance;
  }

  #addStyleMotion<K extends StylePropertyName>(
    name: K,
    value: StylePropertyMap[K]["initial"],
    options: MotionOptions<StylePropertyMap[K]["initial"]>,
  ): this {
    const count = ++this.#styleMotionCount;
    const operation: MotionOperation<StylePropertyMap[K]["initial"]> = {
      id: `${this.ir.id}.${name}.${count}`,
      ordinal: count,
      mode: "absolute",
      value,
      options,
    };
    const operations = this.#styleOperations[name] as MotionOperation<
      StylePropertyMap[K]["initial"]
    >[];
    operations.push(operation);
    this.replaceNode({
      appearance: {
        ...this.ir.appearance,
        fill: normalizeAbsoluteProperty(this.#baseStyleProperties.fill, this.#styleOperations.fill),
        stroke: normalizeAbsoluteProperty(
          this.#baseStyleProperties.stroke,
          this.#styleOperations.stroke,
        ),
        blur: normalizeAbsoluteProperty(this.#baseStyleProperties.blur, this.#styleOperations.blur),
      },
    });
    return this;
  }

  colorTo(target: ColorInput, options: MotionOptions<ColorIR>): this {
    return this.#addStyleMotion("fill", normalizeColor(target), options);
  }

  strokeColorTo(target: ColorInput, options: MotionOptions<ColorIR>): this {
    return this.#addStyleMotion("stroke", normalizeColor(target), options);
  }

  blurTo(target: Length, options: MotionOptions<Length>): this {
    return this.#addStyleMotion("blur", target, options);
  }
}

export type { FollowPathOptions, MoveOptions, ScaleInput } from "./transform-builder.js";
