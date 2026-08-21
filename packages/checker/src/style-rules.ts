import {
  isValidEasing,
  stylePropertyEntries,
  walkNodes,
  type ColorIR,
  type ExperienceIR,
  type MotionSegment,
  type PropertyValue,
} from "@eac/ir";
import { isUnit } from "@eac/units";
import { error, type Diagnostic } from "./diagnostic.js";

const validColor = (value: unknown): value is ColorIR => {
  if (typeof value !== "object" || value === null) return false;
  const color = value as Record<string, unknown>;
  return (
    color.kind === "color" &&
    [color.red, color.green, color.blue, color.alpha].every(
      (channel) => typeof channel === "number" && Number.isFinite(channel),
    ) &&
    [color.red, color.green, color.blue, color.alpha].every(
      (channel) => (channel as number) >= 0 && (channel as number) <= 1,
    )
  );
};

const validLength = (value: unknown, allowZero = true): boolean =>
  isUnit(value, "length") &&
  Number.isFinite(value.value) &&
  (allowZero ? value.value >= 0 : value.value > 0);

export function runStyleRules(experience: ExperienceIR): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const scene of experience.scenes)
    for (const { node } of walkNodes(scene.nodes)) {
      if (node.kind !== "object") continue;
      for (const [name, property] of stylePropertyEntries(node)) {
        const values: unknown[] = [
          property.initial,
          ...property.segments.flatMap((segment) => [
            segment.target,
            ...(segment.from === undefined ? [] : [segment.from]),
          ]),
        ];
        const valid =
          name === "blur" ? values.every((value) => validLength(value)) : values.every(validColor);
        if (!valid)
          diagnostics.push(
            error(
              name === "blur" ? "eac::style::invalid" : "eac::color::invalid",
              `\`${node.id}.${name}\` contains an invalid style value.`,
              `${scene.id}.${node.id}.${name}`,
              name === "blur"
                ? "Blur must be a finite non-negative length."
                : "Colors must contain normalized finite sRGB channels from 0 to 1.",
              [
                name === "blur"
                  ? "use px() with a non-negative value"
                  : "use rgb(), rgba(), or hex()",
              ],
            ),
          );
        for (const segment of property.segments as readonly MotionSegment<PropertyValue>[])
          if (segment.easing !== undefined && !isValidEasing(segment.easing))
            diagnostics.push(
              error(
                "eac::motion::invalid-easing",
                `Motion \`${segment.id}\` has an invalid easing definition.`,
                `${scene.id}.${node.id}.${name}`,
                "Easing coordinates must be finite and cubic Bézier x coordinates must stay within 0–1.",
                ["use a documented easing value"],
              ),
            );
      }
      const appearance = node.appearance;
      const shadow = appearance.shadow;
      const invalidStaticStyle =
        !validLength(appearance.strokeWidth) ||
        (shadow !== undefined &&
          (!isUnit(shadow.offsetX, "length") ||
            !Number.isFinite(shadow.offsetX.value) ||
            !isUnit(shadow.offsetY, "length") ||
            !Number.isFinite(shadow.offsetY.value) ||
            !validLength(shadow.blur) ||
            !validColor(shadow.color))) ||
        (node.geometry.kind === "text" &&
          (node.geometry.fontFamily.length === 0 ||
            !Number.isFinite(node.geometry.fontWeight) ||
            node.geometry.fontWeight < 1 ||
            node.geometry.fontWeight > 1_000 ||
            !["start", "middle", "end"].includes(node.geometry.textAlign) ||
            !isUnit(node.geometry.letterSpacing, "length") ||
            !Number.isFinite(node.geometry.letterSpacing.value)));
      if (invalidStaticStyle)
        diagnostics.push(
          error(
            "eac::style::invalid",
            `\`${node.id}\` contains an invalid static style.`,
            `${scene.id}.${node.id}.appearance`,
            "Stroke, shadow, and text attributes must use finite documented values.",
            ["use non-negative lengths", "use a font weight from 1 to 1000"],
          ),
        );
    }
  return diagnostics;
}
