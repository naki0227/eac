import {
  defaultProperties,
  type AppearanceIR,
  type GeometryIR,
  type LocalAssetIR,
  type NodeIR,
  type Scale2,
  type Vec2,
} from "@eac/ir";
import {
  deg,
  depth,
  opacity,
  px,
  type Angle,
  type Depth,
  type Length,
  type Opacity,
} from "@eac/units";
import { normalizeColor, type ColorInput } from "./color.js";
import { asset } from "./asset.js";
import { ObjectBuilder } from "./object-builder.js";

export type TransformStyle = Readonly<{
  position?: Vec2;
  rotation?: Angle;
  opacity?: Opacity;
  depth?: Depth;
  scale?: number | Readonly<{ x: number; y: number }>;
}>;

export type ObjectStyle = TransformStyle &
  Readonly<{
    position: Vec2;
    fill: ColorInput;
    stroke?: ColorInput;
    strokeWidth?: Length;
    blur?: Length;
    shadow?: Readonly<{
      offsetX: Length;
      offsetY: Length;
      blur: Length;
      color: ColorInput;
    }>;
    /** Defaults to true; set false so a decorative backdrop cannot swallow pointer interaction. */
    interactive?: boolean;
  }>;

export type ImageStyle = Omit<ObjectStyle, "fill" | "stroke"> &
  Readonly<{
    src: string | LocalAssetIR;
    width: Length;
    height: Length;
    fit?: "contain" | "cover" | "fill";
  }>;

function scaleValue(value: TransformStyle["scale"]): Scale2 {
  if (typeof value === "number") return { kind: "scale", x: value, y: value };
  return { kind: "scale", x: value?.x ?? 1, y: value?.y ?? 1 };
}

export function transformProperties(style: TransformStyle) {
  const defaults = defaultProperties(style.position ?? { x: px(0), y: px(0) });
  return {
    ...defaults,
    rotation: { ...defaults.rotation, initial: style.rotation ?? deg(0) },
    scale: { ...defaults.scale, initial: scaleValue(style.scale) },
    opacity: { ...defaults.opacity, initial: style.opacity ?? opacity(1) },
    depth: { ...defaults.depth, initial: style.depth ?? depth(0) },
  };
}

export function createObject(
  nodes: NodeIR[],
  id: string,
  geometry: GeometryIR,
  style: ObjectStyle,
): ObjectBuilder {
  const appearance: AppearanceIR = {
    fill: { kind: "timed", initial: normalizeColor(style.fill), segments: [] },
    stroke: {
      kind: "timed",
      initial: normalizeColor(style.stroke ?? "transparent"),
      segments: [],
    },
    blur: { kind: "timed", initial: style.blur ?? px(0), segments: [] },
    strokeWidth: style.strokeWidth ?? px(1),
    ...(style.shadow === undefined
      ? {}
      : {
          shadow: {
            offsetX: style.shadow.offsetX,
            offsetY: style.shadow.offsetY,
            blur: style.shadow.blur,
            color: normalizeColor(style.shadow.color),
          },
        }),
  };
  const object = new ObjectBuilder(
    id,
    geometry,
    appearance,
    transformProperties(style),
    nodes.length,
    style.interactive ?? true,
  );
  nodes.push(object.ir);
  return object;
}

export function createImage(nodes: NodeIR[], id: string, style: ImageStyle): ObjectBuilder {
  return createObject(
    nodes,
    id,
    {
      kind: "image",
      asset: typeof style.src === "string" ? asset(style.src) : style.src,
      width: style.width,
      height: style.height,
      fit: style.fit ?? "contain",
    },
    { ...style, fill: "transparent" },
  );
}
