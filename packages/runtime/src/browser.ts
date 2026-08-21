import { px, type Length } from "@eac/units";
import type { ScenarioEventPayload } from "@eac/ir";

export type Rect = Readonly<{ left: number; top: number; width: number; height: number }>;
export type Canvas = Readonly<{ width: number; height: number }>;
export type ScenePoint = Readonly<{ x: number; y: number }>;

/**
 * Maps a client-space point onto scene coordinates.
 *
 * The preview scales the SVG to fit while preserving aspect ratio, so the drawn image is letterboxed
 * inside its element. This undoes exactly that: fit scale, then centring offset, then division. It
 * takes plain numbers rather than DOM objects so the conversion is unit-testable without a browser.
 *
 * `devicePixelRatio` is deliberately absent: `getBoundingClientRect` and pointer client coordinates
 * are both in CSS pixels, so the ratio cancels and introducing it would double-count.
 */
export function toScenePoint(
  rect: Rect,
  canvas: Canvas,
  clientX: number,
  clientY: number,
): ScenePoint | undefined {
  if (rect.width <= 0 || rect.height <= 0 || canvas.width <= 0 || canvas.height <= 0)
    return undefined;
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return undefined;
  const scale = Math.min(rect.width / canvas.width, rect.height / canvas.height);
  if (!Number.isFinite(scale) || scale <= 0) return undefined;
  const offsetX = (rect.width - canvas.width * scale) / 2;
  const offsetY = (rect.height - canvas.height * scale) / 2;
  const x = (clientX - rect.left - offsetX) / scale;
  const y = (clientY - rect.top - offsetY) / scale;
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : undefined;
}

export const isInsideCanvas = (point: ScenePoint, canvas: Canvas): boolean =>
  point.x >= 0 && point.y >= 0 && point.x <= canvas.width && point.y <= canvas.height;

const length = (value: number): Length => px(Number(value.toFixed(3)));

export const pointerMove = (point: ScenePoint): ScenarioEventPayload => ({
  kind: "pointerMove",
  x: length(point.x),
  y: length(point.y),
});
export const pointerDown = (): ScenarioEventPayload => ({ kind: "pointerDown" });
export const pointerUp = (): ScenarioEventPayload => ({ kind: "pointerUp" });
export const pointerLeave = (): ScenarioEventPayload => ({ kind: "pointerLeave" });
export const scrollTo = (x: number, y: number): ScenarioEventPayload => ({
  kind: "scroll",
  x: length(x),
  y: length(y),
});

/**
 * The key identity EaC uses. `KeyboardEvent.code` is layout-independent and stable, and it is what
 * scenario files record, so a scenario written on one keyboard layout replays on another.
 */
export const normalizeKey = (
  event: Readonly<{ code?: string; key?: string }>,
): string | undefined => {
  const code = event.code ?? event.key;
  return code === undefined || code.length === 0 ? undefined : code;
};

export const keyDown = (code: string): ScenarioEventPayload => ({ kind: "keyDown", code });
export const keyUp = (code: string): ScenarioEventPayload => ({ kind: "keyUp", code });

/**
 * Suppresses the pointer moves that cannot change a hit test. The threshold is in scene pixels and
 * applies identically to the live session and the recording, because both read this one stream.
 */
export class PointerCoalescer {
  #last: ScenePoint | undefined;

  constructor(private readonly threshold = 1) {}

  accept(point: ScenePoint): boolean {
    const previous = this.#last;
    if (
      previous !== undefined &&
      Math.abs(point.x - previous.x) < this.threshold &&
      Math.abs(point.y - previous.y) < this.threshold
    )
      return false;
    this.#last = point;
    return true;
  }

  reset(): void {
    this.#last = undefined;
  }
}
