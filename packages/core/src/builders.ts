import {
  defaultProperties,
  type AppearanceIR,
  type ExperienceIR,
  type GeometryIR,
  type ObjectIR,
  type SceneIR,
  type Vec2,
} from "@eac/ir";
import {
  deg,
  depth,
  opacity,
  px,
  sec,
  type Angle,
  type Depth,
  type Length,
  type Opacity,
  type Time,
} from "@eac/units";
import { ObjectBuilder } from "./object-builder.js";

type ObjectStyle = Readonly<{
  position: Vec2;
  fill: string;
  stroke?: string;
  rotation?: Angle;
  opacity?: Opacity;
  depth?: Depth;
}>;

function properties(style: ObjectStyle) {
  const defaults = defaultProperties(style.position);
  return {
    ...defaults,
    rotation: { ...defaults.rotation, initial: style.rotation ?? deg(0) },
    opacity: { ...defaults.opacity, initial: style.opacity ?? opacity(1) },
    depth: { ...defaults.depth, initial: style.depth ?? depth(0) },
  };
}

export class SceneBuilder {
  readonly #scene: { id: string; start: Time; duration: Time; objects: ObjectIR[] };

  constructor(id: string, options: Readonly<{ at?: Time; duration: Time }>) {
    this.#scene = { id, start: options.at ?? sec(0), duration: options.duration, objects: [] };
  }

  get ir(): SceneIR {
    return this.#scene;
  }

  #object(id: string, geometry: GeometryIR, style: ObjectStyle): ObjectBuilder {
    const appearance: AppearanceIR = {
      fill: style.fill,
      ...(style.stroke === undefined ? {} : { stroke: style.stroke }),
    };
    const object = new ObjectBuilder(
      id,
      geometry,
      appearance,
      properties(style),
      this.#scene.objects.length,
    );
    this.#scene.objects.push(object.ir);
    return object;
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
    options: ObjectStyle & Readonly<{ fontSize: Length; width?: Length }>,
  ): ObjectBuilder {
    const geometry: GeometryIR = {
      kind: "text",
      text,
      fontSize: options.fontSize,
      ...(options.width === undefined ? {} : { width: options.width }),
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
        strokeWidth: options.strokeWidth ?? px(1),
      },
      options,
    );
  }
}

export class ExperienceBuilder {
  readonly #experience: {
    version: "0.1";
    name: string;
    canvas: { width: Length; height: Length };
    duration: Time;
    fps: number;
    scenes: SceneIR[];
  };

  constructor(
    options: Readonly<{
      name: string;
      width: Length;
      height: Length;
      duration: Time;
      fps?: number;
    }>,
  ) {
    this.#experience = {
      version: "0.1",
      name: options.name,
      canvas: { width: options.width, height: options.height },
      duration: options.duration,
      fps: options.fps ?? 60,
      scenes: [],
    };
  }

  scene(id: string, options: Readonly<{ at?: Time; duration?: Time }> = {}): SceneBuilder {
    const scene = new SceneBuilder(id, {
      ...(options.at === undefined ? {} : { at: options.at }),
      duration: options.duration ?? this.#experience.duration,
    });
    this.#experience.scenes.push(scene.ir);
    return scene;
  }

  build(): ExperienceIR {
    return this.#experience;
  }
}

export const experience = (
  options: ConstructorParameters<typeof ExperienceBuilder>[0],
): ExperienceBuilder => new ExperienceBuilder(options);
