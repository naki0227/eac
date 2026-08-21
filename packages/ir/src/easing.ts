import type { Easing } from "./types.js";

const clamp = (value: number): number => Math.max(0, Math.min(1, value));

function cubicCoordinate(t: number, first: number, second: number): number {
  const inverse = 1 - t;
  return 3 * inverse ** 2 * t * first + 3 * inverse * t ** 2 * second + t ** 3;
}

function cubicDerivative(t: number, first: number, second: number): number {
  const inverse = 1 - t;
  return 3 * inverse ** 2 * first + 6 * inverse * t * (second - first) + 3 * t ** 2 * (1 - second);
}

function cubicBezier(progress: number, easing: Extract<Easing, { kind: "cubic-bezier" }>): number {
  let parameter = progress;
  for (let iteration = 0; iteration < 8; iteration++) {
    const difference = cubicCoordinate(parameter, easing.x1, easing.x2) - progress;
    const derivative = cubicDerivative(parameter, easing.x1, easing.x2);
    if (Math.abs(difference) < 1e-7 || Math.abs(derivative) < 1e-7) break;
    parameter = clamp(parameter - difference / derivative);
  }
  let low = 0;
  let high = 1;
  for (let iteration = 0; iteration < 12; iteration++) {
    const x = cubicCoordinate(parameter, easing.x1, easing.x2);
    if (Math.abs(x - progress) < 1e-7) break;
    if (x < progress) low = parameter;
    else high = parameter;
    parameter = (low + high) / 2;
  }
  return cubicCoordinate(parameter, easing.y1, easing.y2);
}

export function applyEasing(easing: Easing, progress: number): number {
  const value = clamp(progress);
  if (easing.kind === "linear") return value;
  if (easing.kind === "ease-in") return value ** 2;
  if (easing.kind === "ease-out") return 1 - (1 - value) ** 2;
  if (easing.kind === "ease-in-out")
    return value < 0.5 ? 2 * value ** 2 : 1 - (-2 * value + 2) ** 2 / 2;
  return cubicBezier(value, easing);
}

export function isValidEasing(value: unknown): value is Easing {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (["linear", "ease-in", "ease-out", "ease-in-out"].includes(String(candidate.kind)))
    return true;
  return (
    candidate.kind === "cubic-bezier" &&
    [candidate.x1, candidate.y1, candidate.x2, candidate.y2].every(
      (coordinate) => typeof coordinate === "number" && Number.isFinite(coordinate),
    ) &&
    (candidate.x1 as number) >= 0 &&
    (candidate.x1 as number) <= 1 &&
    (candidate.x2 as number) >= 0 &&
    (candidate.x2 as number) <= 1
  );
}
