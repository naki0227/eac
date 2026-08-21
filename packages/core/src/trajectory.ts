import type {
  EllipseTrajectory,
  OrbitTrajectory,
  SpiralTrajectory,
  Vec2,
  WaveTrajectory,
} from "@eac/ir";
import { deg, type Angle, type Length } from "@eac/units";

const positive = (name: string, value: number): void => {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be positive`);
};

const nonNegative = (name: string, value: number): void => {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must be non-negative`);
};

const vector = (value: Vec2): Vec2 => Object.freeze({ x: value.x, y: value.y });

export const trajectory = Object.freeze({
  ellipse(
    options: Readonly<{
      center: Vec2;
      radiusX: Length;
      radiusY: Length;
      rotation?: Angle;
      startAngle?: Angle;
      endAngle?: Angle;
    }>,
  ): EllipseTrajectory {
    positive("ellipse radiusX", options.radiusX.value);
    positive("ellipse radiusY", options.radiusY.value);
    const startAngle = options.startAngle ?? deg(0);
    const endAngle = options.endAngle ?? deg(360);
    if (startAngle.value === endAngle.value)
      throw new RangeError("ellipse angles must describe a non-degenerate arc");
    return Object.freeze({
      kind: "ellipse",
      center: vector(options.center),
      radiusX: options.radiusX,
      radiusY: options.radiusY,
      rotation: options.rotation ?? deg(0),
      startAngle,
      endAngle,
    });
  },
  orbit(
    options: Readonly<{
      center: Vec2;
      radius: Length;
      startAngle?: Angle;
      turns?: number;
    }>,
  ): OrbitTrajectory {
    positive("orbit radius", options.radius.value);
    const turns = options.turns ?? 1;
    positive("orbit turns", turns);
    return Object.freeze({
      kind: "orbit",
      center: vector(options.center),
      radius: options.radius,
      startAngle: options.startAngle ?? deg(0),
      turns,
    });
  },
  spiral(
    options: Readonly<{
      center: Vec2;
      startRadius: Length;
      endRadius: Length;
      turns?: number;
      startAngle?: Angle;
    }>,
  ): SpiralTrajectory {
    nonNegative("spiral startRadius", options.startRadius.value);
    nonNegative("spiral endRadius", options.endRadius.value);
    if (options.startRadius.value === 0 && options.endRadius.value === 0)
      throw new RangeError("spiral must have a non-zero radius");
    const turns = options.turns ?? 1;
    positive("spiral turns", turns);
    return Object.freeze({
      kind: "spiral",
      center: vector(options.center),
      startRadius: options.startRadius,
      endRadius: options.endRadius,
      turns,
      startAngle: options.startAngle ?? deg(0),
    });
  },
  wave(
    options: Readonly<{
      start: Vec2;
      end: Vec2;
      amplitude: Length;
      cycles?: number;
      phase?: Angle;
    }>,
  ): WaveTrajectory {
    positive("wave amplitude", options.amplitude.value);
    const cycles = options.cycles ?? 1;
    positive("wave cycles", cycles);
    if (
      options.start.x.value === options.end.x.value &&
      options.start.y.value === options.end.y.value
    )
      throw new RangeError("wave baseline must have distinct start and end points");
    return Object.freeze({
      kind: "wave",
      start: vector(options.start),
      end: vector(options.end),
      amplitude: options.amplitude,
      cycles,
      phase: options.phase ?? deg(0),
    });
  },
});
