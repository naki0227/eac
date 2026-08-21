import type { GeometryIR, GroupIR, NodeIR, Vec2 } from "@eac/ir";
import { px, type Length } from "@eac/units";
import {
  createObject,
  transformProperties,
  type ObjectStyle,
  type TransformStyle,
} from "./node-factory.js";
import { ObjectBuilder } from "./object-builder.js";
import { TransformBuilder } from "./transform-builder.js";

export class GroupBuilder extends TransformBuilder<GroupIR> {
  readonly #children: NodeIR[];

  constructor(id: string, style: TransformStyle, sourceOrder: number) {
    const children: NodeIR[] = [];
    super({
      kind: "group",
      id,
      properties: transformProperties(style),
      dependencies: [],
      unsupportedProperties: [],
      sourceOrder,
      children,
    });
    this.#children = children;
  }

  #object(id: string, geometry: GeometryIR, style: ObjectStyle): ObjectBuilder {
    return createObject(this.#children, id, geometry, style);
  }

  rect(
    id: string,
    options: ObjectStyle & Readonly<{ width: Length; height: Length; cornerRadius?: Length }>,
  ): ObjectBuilder {
    return this.#object(
      id,
      {
        kind: "rect",
        width: options.width,
        height: options.height,
        cornerRadius: options.cornerRadius ?? px(0),
      },
      options,
    );
  }

  circle(id: string, options: ObjectStyle & Readonly<{ radius: Length }>): ObjectBuilder {
    return this.#object(id, { kind: "circle", radius: options.radius }, options);
  }

  text(
    id: string,
    text: string,
    options: ObjectStyle &
      Readonly<{
        fontSize: Length;
        width?: Length;
        fontFamily?: string;
        fontWeight?: number;
        textAlign?: "start" | "middle" | "end";
        letterSpacing?: Length;
      }>,
  ): ObjectBuilder {
    const geometry: GeometryIR = {
      kind: "text",
      text,
      fontSize: options.fontSize,
      ...(options.width === undefined ? {} : { width: options.width }),
      fontFamily: options.fontFamily ?? "sans-serif",
      fontWeight: options.fontWeight ?? 400,
      textAlign: options.textAlign ?? "start",
      letterSpacing: options.letterSpacing ?? px(0),
    };
    return this.#object(id, geometry, options);
  }

  path(
    id: string,
    points: readonly Vec2[],
    options: ObjectStyle & Readonly<{ closed?: boolean; strokeWidth?: Length }>,
  ): ObjectBuilder {
    return this.#object(
      id,
      {
        kind: "path",
        points,
        closed: options.closed ?? false,
      },
      options,
    );
  }

  group(id: string, style: TransformStyle = {}): GroupBuilder {
    const group = new GroupBuilder(id, style, this.#children.length);
    this.#children.push(group.ir);
    return group;
  }
}
