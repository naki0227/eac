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
import { ReactiveScene } from "./reactive-scene.js";

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
  readonly reactive = new ReactiveScene();

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
    // Reactive authoring is collected mutably and frozen here, alongside the node tree.
    return {
      ...this.#scene,
      reactive: {
        states: [...this.reactive.states],
        bindings: [...this.reactive.bindings],
        rules: [...this.reactive.rules],
        sounds: [...this.reactive.sounds],
      },
    };
  }

  state(name: string, initial: boolean): ReturnType<ReactiveScene["booleanState"]>;
  state(name: string, initial: number): ReturnType<ReactiveScene["numberState"]>;
  state(name: string, initial: boolean | number): unknown {
    return typeof initial === "boolean"
      ? this.reactive.booleanState(name, initial)
      : this.reactive.numberState(name, initial);
  }

  bind(...args: Parameters<ReactiveScene["bind"]>): this {
    this.reactive.bind(...args);
    return this;
  }

  on(...args: Parameters<ReactiveScene["on"]>): this {
    this.reactive.on(...args);
    return this;
  }

  sound(...args: Parameters<ReactiveScene["sound"]>): ReturnType<ReactiveScene["sound"]> {
    return this.reactive.sound(...args);
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
    version: "0.3";
    irVersion: 3;
    name: string;
    canvas: { width: Length; height: Length };
    duration: Time;
    fps: number;
    scenes: SceneIR[];
  };
  /** Scenes are materialized at build() so reactive declarations added after scene() are included. */
  readonly #sceneBuilders: SceneBuilder[] = [];

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
      version: "0.3",
      irVersion: 3,
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
    this.#sceneBuilders.push(scene);
    return scene;
  }

  build(): ExperienceIR {
    return { ...this.#experience, scenes: this.#sceneBuilders.map((scene) => scene.ir) };
  }
}

export const experience = (
  options: ConstructorParameters<typeof ExperienceBuilder>[0],
): ExperienceBuilder => new ExperienceBuilder(options);
