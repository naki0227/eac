import {
  type AudioClipIR,
  type ExperienceIR,
  type LocalAssetIR,
  type SceneIR,
  type Vec2,
} from "@eac/ir";
import { type Length, type Time } from "@eac/units";
import { GroupBuilder } from "./group-builder.js";
import { type ImageStyle, type ObjectStyle, type TransformStyle } from "./node-factory.js";
import { ObjectBuilder } from "./object-builder.js";
import { ReactiveScene } from "./reactive-scene.js";
export type AudioOptions = Readonly<{
  id?: string;
  at?: Time;
  duration?: Time;
  trim?: Readonly<{
    start?: Time;
    end?: Time;
  }>;
  volume?: number;
  fadeIn?: Time;
  fadeOut?: Time;
}>;
export declare class SceneBuilder {
  #private;
  readonly reactive: ReactiveScene;
  constructor(
    id: string,
    options: Readonly<{
      at?: Time;
      duration: Time;
    }>,
  );
  get ir(): SceneIR;
  state(name: string, initial: boolean): ReturnType<ReactiveScene["booleanState"]>;
  state(name: string, initial: number): ReturnType<ReactiveScene["numberState"]>;
  bind(...args: Parameters<ReactiveScene["bind"]>): this;
  on(...args: Parameters<ReactiveScene["on"]>): this;
  sound(...args: Parameters<ReactiveScene["sound"]>): ReturnType<ReactiveScene["sound"]>;
  rect(
    id: string,
    options: ObjectStyle &
      Readonly<{
        width: Length;
        height: Length;
        cornerRadius?: Length;
      }>,
  ): ObjectBuilder;
  circle(
    id: string,
    options: ObjectStyle &
      Readonly<{
        radius: Length;
      }>,
  ): ObjectBuilder;
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
  ): ObjectBuilder;
  path(
    id: string,
    points: readonly Vec2[],
    options: ObjectStyle &
      Readonly<{
        closed?: boolean;
        strokeWidth?: Length;
      }>,
  ): ObjectBuilder;
  image(id: string, options: ImageStyle): ObjectBuilder;
  audio(source: string | LocalAssetIR, options?: AudioOptions): AudioClipIR;
  group(id: string, style?: TransformStyle): GroupBuilder;
}
export declare class ExperienceBuilder {
  #private;
  constructor(
    options: Readonly<{
      name: string;
      width: Length;
      height: Length;
      duration: Time;
      fps?: number;
    }>,
  );
  scene(
    id: string,
    options?: Readonly<{
      at?: Time;
      duration?: Time;
    }>,
  ): SceneBuilder;
  build(): ExperienceIR;
}
export declare const experience: (
  options: ConstructorParameters<typeof ExperienceBuilder>[0],
) => ExperienceBuilder;
//# sourceMappingURL=builders.d.ts.map
