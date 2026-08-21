import { type ExperienceIR, type GeometryIR, type NodeIR, type SceneIR, type Vec2 } from "@eac/ir";
import { px, sec, type Length, type Time } from "@eac/units";
import { GroupBuilder } from "./group-builder.js";
import { createObject, type ObjectStyle, type TransformStyle } from "./node-factory.js";
import { ObjectBuilder } from "./object-builder.js";

export class SceneBuilder {
  readonly #scene: { id: string; start: Time; duration: Time; nodes: NodeIR[] };

  constructor(id: string, options: Readonly<{ at?: Time; duration: Time }>) {
    this.#scene = { id, start: options.at ?? sec(0), duration: options.duration, nodes: [] };
  }

  get ir(): SceneIR {
    return this.#scene;
  }

  #object(id: string, geometry: GeometryIR, style: ObjectStyle): ObjectBuilder {
    return createObject(this.#scene.nodes, id, geometry, style);
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

  group(id: string, style: TransformStyle = {}): GroupBuilder {
    const group = new GroupBuilder(id, style, this.#scene.nodes.length);
    this.#scene.nodes.push(group.ir);
    return group;
  }
}

export class ExperienceBuilder {
  readonly #experience: {
    version: "0.2";
    irVersion: 2;
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
      version: "0.2",
      irVersion: 2,
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
