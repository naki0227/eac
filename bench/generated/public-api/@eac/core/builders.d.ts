import { type ExperienceIR, type SceneIR, type Vec2 } from "@eac/ir";
import { type Angle, type Depth, type Length, type Opacity, type Time } from "@eac/units";
import { ObjectBuilder } from "./object-builder.js";
type ObjectStyle = Readonly<{
  position: Vec2;
  fill: string;
  stroke?: string;
  rotation?: Angle;
  opacity?: Opacity;
  depth?: Depth;
}>;
export declare class SceneBuilder {
  #private;
  constructor(
    id: string,
    options: Readonly<{
      at?: Time;
      duration: Time;
    }>,
  );
  get ir(): SceneIR;
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
export {};
//# sourceMappingURL=builders.d.ts.map
