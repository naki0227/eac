import type {
  ExperienceIR,
  MotionSegment,
  PropertyName,
  PropertyValue,
  TimedProperty,
} from "@eac/ir";
import { isUnit, type UnitKind } from "@eac/units";
import { error, type Diagnostic } from "./diagnostic.js";

const propertyKinds: Readonly<Record<PropertyName, UnitKind | "vec2">> = {
  position: "vec2",
  rotation: "angle",
  opacity: "opacity",
  depth: "depth",
};

function isFiniteUnit(value: unknown, kind: UnitKind): boolean {
  return isUnit(value, kind) && Number.isFinite(value.value);
}

function validValue(value: unknown, kind: UnitKind | "vec2"): boolean {
  if (kind !== "vec2") return isFiniteUnit(value, kind);
  if (typeof value !== "object" || value === null) return false;
  const vector = value as { x?: unknown; y?: unknown };
  return isFiniteUnit(vector.x, "length") && isFiniteUnit(vector.y, "length");
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
        for (const segment of property.segments as readonly MotionSegment<PropertyValue>[])
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
        const trajectory = segment.trajectory;
        const invalidTrajectory =
          (trajectory?.kind === "bezier" &&
            (!validValue(trajectory.control1, "vec2") ||
              !validValue(trajectory.control2, "vec2"))) ||
          (trajectory?.kind === "cycloid" &&
            (!isFiniteUnit(trajectory.radius, "length") ||
              trajectory.radius.value <= 0 ||
              (trajectory.turns !== undefined &&
                (!Number.isFinite(trajectory.turns) || trajectory.turns <= 0))));
        if (invalidTrajectory)
          diagnostics.push(
            error(
              "eac::geometry::invalid",
              `Motion \`${segment.id}\` has an invalid ${trajectory.kind} trajectory.`,
              `${scene.id}.${object.id}.position`,
              "Trajectories require finite geometry and positive cycloid radius and turns.",
              ["provide finite Bézier control points", "use a positive cycloid radius and turns"],
            ),
          );
      }
    }
  return diagnostics;
}

export function runValueRules(experience: ExperienceIR): Diagnostic[] {
  return [...numericAndUnits(experience), ...geometry(experience)];
}
