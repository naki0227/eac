import type { MotionSegment, PropertyValue } from "@eac/ir";

const WIDTH = 41;

const column = (time: number, duration: number): number =>
  Math.max(0, Math.min(WIDTH - 1, Math.round((time / duration) * (WIDTH - 1))));

const row = (
  segment: MotionSegment<PropertyValue>,
  duration: number,
  mark: string,
  labelWidth: number,
): string => {
  const cells = Array.from({ length: WIDTH }, () => " ");
  const start = column(segment.start.value, duration);
  const end = column(segment.start.value + segment.duration.value, duration);
  for (let index = start; index <= Math.max(start, end); index++) cells[index] = mark;
  return `${segment.id.padEnd(labelWidth)} |${cells.join("")}|`;
};

export function conflictTimeline(
  property: string,
  first: MotionSegment<PropertyValue>,
  second: MotionSegment<PropertyValue>,
  duration: number,
): readonly string[] {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 1;
  const labelWidth = Math.max("conflict".length, first.id.length, second.id.length);
  const overlapStart = Math.max(first.start.value, second.start.value);
  const overlapEnd = Math.min(
    first.start.value + first.duration.value,
    second.start.value + second.duration.value,
  );
  const conflict = Array.from({ length: WIDTH }, () => " ");
  const start = column(overlapStart, safeDuration);
  const end = column(overlapEnd, safeDuration);
  for (let index = start; index <= Math.max(start, end); index++) conflict[index] = "^";
  return [
    `${property} writer timeline`,
    `${"".padEnd(labelWidth + 1)}0s${"".padEnd(WIDTH - 8)}${safeDuration.toFixed(2)}s`,
    `${"".padEnd(labelWidth + 1)}|${"-".repeat(WIDTH)}|`,
    row(first, safeDuration, "━", labelWidth),
    row(second, safeDuration, "━", labelWidth),
    `${"conflict".padEnd(labelWidth)} |${conflict.join("")}|`,
  ];
}
