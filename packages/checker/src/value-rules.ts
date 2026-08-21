import {
  isValidEasing,
  type ExperienceIR,
  type MotionSegment,
  type PropertyName,
  type PropertyValue,
  type TimedProperty,
} from "@eac/ir";
import { isUnit, type UnitKind, type UnitValue } from "@eac/units";
import { error, type Diagnostic } from "./diagnostic.js";
import { isValidTrajectory } from "./trajectory-rules.js";

const propertyKinds: Readonly<Record<PropertyName, UnitKind | "vec2" | "scale">> = {
  position: "vec2",
  rotation: "angle",
  scale: "scale",
  opacity: "opacity",
  depth: "depth",
};

function isFiniteUnit<K extends UnitKind>(value: unknown, kind: K): value is UnitValue<K> {
  return isUnit(value, kind) && Number.isFinite(value.value);
}

function isFiniteVector(
  value: unknown,
): value is Readonly<{ x: UnitValue<"length">; y: UnitValue<"length"> }> {
  if (typeof value !== "object" || value === null) return false;
  const vector = value as { x?: unknown; y?: unknown };
  return isFiniteUnit(vector.x, "length") && isFiniteUnit(vector.y, "length");
}

function validValue(value: unknown, kind: UnitKind | "vec2" | "scale"): boolean {
  if (kind === "scale") {
    if (typeof value !== "object" || value === null) return false;
    const scale = value as { kind?: unknown; x?: unknown; y?: unknown };
    return (
      scale.kind === "scale" &&
      typeof scale.x === "number" &&
      Number.isFinite(scale.x) &&
      typeof scale.y === "number" &&
      Number.isFinite(scale.y)
    );
  }
  if (kind !== "vec2") return isFiniteUnit(value, kind);
  return isFiniteVector(value);
}

function numericAndUnits(experience: ExperienceIR): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const experienceUnits: readonly [unknown, UnitKind, string][] = [
    [experience.canvas.width, "length", "canvas.width"],
    [experience.canvas.height, "length", "canvas.height"],
    [experience.duration, "time", "duration"],
  ];
  for (const [value, kind, location] of experienceUnits)
    if (!isFiniteUnit(value, kind))
      diagnostics.push(
        error(
          "eac::unit::invalid",
          `Expected a finite ${kind} value.`,
          location,
          "Unit-aware values prevent ambiguous or invalid rendering input.",
          [`use the ${kind} constructor for this value`],
        ),
      );
  for (const scene of experience.scenes) {
    for (const [value, location] of [
      [scene.start, `${scene.id}.start`],
      [scene.duration, `${scene.id}.duration`],
    ] as const)
      if (!isFiniteUnit(value, "time"))
        diagnostics.push(
          error(
            "eac::unit::invalid",
            "Expected a finite time value.",
            location,
            "Scene timing must use Time values.",
            ["use sec(value) or ms(value)"],
          ),
        );
    for (const object of scene.objects) {
      for (const name of Object.keys(object.properties) as PropertyName[]) {
        const property = object.properties[name] as TimedProperty<PropertyValue>;
        const kind = propertyKinds[name];
        if (!validValue(property.initial, kind))
          diagnostics.push(
            error(
              "eac::numeric::invalid",
              `\`${object.id}.${name}\` has an invalid initial value.`,
              `${scene.id}.${object.id}.${name}`,
              "NaN, Infinity, invalid vectors, and incorrect units cannot be rendered deterministically.",
              ["replace it with a finite value using the documented unit constructor"],
            ),
          );
        for (const segment of property.segments as readonly MotionSegment<PropertyValue>[]) {
          if (
            !validValue(segment.target, kind) ||
            (segment.from !== undefined && !validValue(segment.from, kind)) ||
            !isFiniteUnit(segment.start, "time") ||
            !isFiniteUnit(segment.duration, "time")
          )
            diagnostics.push(
              error(
                "eac::numeric::invalid",
                `Motion \`${segment.id}\` contains NaN, Infinity, an invalid vector, or an incorrect unit.`,
                `${scene.id}.${object.id}.${name}`,
                "All timed values must be finite and unit-correct to remain seekable.",
                ["replace invalid values", "use eac docs for the expected units"],
              ),
            );
          if (segment.easing !== undefined && !isValidEasing(segment.easing))
            diagnostics.push(
              error(
                "eac::motion::invalid-easing",
                `Motion \`${segment.id}\` has an invalid easing definition.`,
                `${scene.id}.${object.id}.${name}`,
                "Easing coordinates must be finite and cubic Bézier x coordinates must stay within 0–1.",
                [
                  "use easing.linear, easeIn, easeOut, or easeInOut",
                  "use easing.cubicBezier with x coordinates from 0 to 1",
                ],
              ),
            );
        }
        if (name === "opacity")
          for (const segment of property.segments)
            if ("value" in segment.target && (segment.target.value < 0 || segment.target.value > 1))
              diagnostics.push(
                error(
                  "eac::numeric::invalid-opacity",
                  `Motion \`${segment.id}\` targets opacity outside 0–1.`,
                  `${scene.id}.${object.id}.opacity`,
                  "Opacity outside the normalized range is invalid.",
                  ["use opacity(value) with a value from 0 to 1"],
                ),
              );
      }
      if (
        object.properties.opacity.initial.value < 0 ||
        object.properties.opacity.initial.value > 1
      )
        diagnostics.push(
          error(
            "eac::numeric::invalid-opacity",
            `\`${object.id}.opacity\` is outside 0–1.`,
            `${scene.id}.${object.id}.opacity`,
            "Opacity outside the normalized range is invalid.",
            ["use opacity(value) with a value from 0 to 1"],
          ),
        );
      const scales = [
        object.properties.scale.initial,
        ...object.properties.scale.segments.flatMap((segment) => [
          segment.target,
          ...(segment.from === undefined ? [] : [segment.from]),
        ]),
      ];
      if (scales.some((scale) => validValue(scale, "scale") && (scale.x <= 0 || scale.y <= 0)))
        diagnostics.push(
          error(
            "eac::transform::invalid-scale",
            `\`${object.id}.scale\` contains a non-positive scale.`,
            `${scene.id}.${object.id}.scale`,
            "EaC v0.2 requires positive scale components for deterministic non-reflecting transforms.",
            ["use scale values greater than zero"],
          ),
        );
    }
  }
  return diagnostics;
}

function geometry(experience: ExperienceIR): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const scene of experience.scenes)
    for (const object of scene.objects) {
      const geometry = object.geometry;
      const invalid =
        (geometry.kind === "rect" &&
          (!isFiniteUnit(geometry.width, "length") ||
            !isFiniteUnit(geometry.height, "length") ||
            !isFiniteUnit(geometry.cornerRadius, "length") ||
            geometry.width.value <= 0 ||
            geometry.height.value <= 0 ||
            geometry.cornerRadius.value < 0)) ||
        (geometry.kind === "circle" &&
          (!isFiniteUnit(geometry.radius, "length") || geometry.radius.value <= 0)) ||
        (geometry.kind === "text" &&
          (geometry.text.length === 0 ||
            !isFiniteUnit(geometry.fontSize, "length") ||
            geometry.fontSize.value <= 0)) ||
        (geometry.kind === "path" &&
          (geometry.points.length < 2 ||
            !isFiniteUnit(geometry.strokeWidth, "length") ||
            geometry.strokeWidth.value <= 0 ||
            geometry.points.some(
              (point) => !isFiniteUnit(point.x, "length") || !isFiniteUnit(point.y, "length"),
            )));
      if (invalid)
        diagnostics.push(
          error(
            "eac::geometry::invalid",
            `\`${object.id}\` has invalid ${geometry.kind} geometry.`,
            `${scene.id}.${object.id}.geometry`,
            "Geometry needs finite positive dimensions and sufficient path points.",
            ["provide positive dimensions", "provide at least two path points"],
          ),
        );
      for (const segment of object.properties.position.segments) {
        const trajectory: unknown = segment.trajectory;
        if (trajectory !== undefined && !isValidTrajectory(trajectory))
          diagnostics.push(
            error(
              "eac::geometry::invalid",
              `Motion \`${segment.id}\` has an invalid trajectory.`,
              `${scene.id}.${object.id}.position`,
              "A trajectory must use finite, non-degenerate geometry and deterministic parameters.",
              [
                'use { kind: "linear" } for linear motion',
                "use eac docs trajectory for supported curved paths",
              ],
            ),
          );
      }
    }
  return diagnostics;
}

export function runValueRules(experience: ExperienceIR): Diagnostic[] {
  return [...numericAndUnits(experience), ...geometry(experience)];
}
