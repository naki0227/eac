import {
  type AudioClipIR,
  type ExperienceIR,
  type GeometryIR,
  type LocalAssetIR,
  type NodeIR,
  type SceneIR,
  type Vec2,
} from "@eac/ir";
import { px, sec, type Length, type Time } from "@eac/units";
import { GroupBuilder } from "./group-builder.js";
import {
  createImage,
  createObject,
  type ImageStyle,
  type ObjectStyle,
  type TransformStyle,
} from "./node-factory.js";
import { ObjectBuilder } from "./object-builder.js";
import { asset } from "./asset.js";

export type AudioOptions = Readonly<{
  id?: string;
  at?: Time;
  duration?: Time;
  trim?: Readonly<{ start?: Time; end?: Time }>;
  volume?: number;
  fadeIn?: Time;
  fadeOut?: Time;
}>;

export class SceneBuilder {
  readonly #scene: {
    id: string;
    start: Time;
    duration: Time;
    nodes: NodeIR[];
    audioClips: AudioClipIR[];
  };

  constructor(id: string, options: Readonly<{ at?: Time; duration: Time }>) {
    this.#scene = {
      id,
      start: options.at ?? sec(0),
      duration: options.duration,
      nodes: [],
      audioClips: [],
    };
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

  image(id: string, options: ImageStyle): ObjectBuilder {
    return createImage(this.#scene.nodes, id, options);
  }

  audio(source: string | LocalAssetIR, options: AudioOptions = {}): AudioClipIR {
    const clip: AudioClipIR = {
      id: options.id ?? `audio-${this.#scene.audioClips.length + 1}`,
      asset: typeof source === "string" ? asset(source) : source,
      start: options.at ?? sec(0),
      ...(options.duration === undefined ? {} : { duration: options.duration }),
      trimStart: options.trim?.start ?? sec(0),
      ...(options.trim?.end === undefined ? {} : { trimEnd: options.trim.end }),
      volume: options.volume ?? 1,
      fadeIn: options.fadeIn ?? sec(0),
      fadeOut: options.fadeOut ?? sec(0),
    };
    this.#scene.audioClips.push(clip);
    return clip;
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
