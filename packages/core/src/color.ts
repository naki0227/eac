import type { ColorIR } from "@eac/ir";

export type ColorInput = ColorIR | string;

const normalized = (red: number, green: number, blue: number, alpha: number): ColorIR =>
  Object.freeze({ kind: "color", red, green, blue, alpha });

const channel = (name: string, value: number): number => {
  if (!Number.isFinite(value) || value < 0 || value > 255)
    throw new RangeError(`${name} must be between 0 and 255`);
  return value / 255;
};

const alphaChannel = (value: number): number => {
  if (!Number.isFinite(value) || value < 0 || value > 1)
    throw new RangeError("alpha must be between 0 and 1");
  return value;
};

export const rgb = (red: number, green: number, blue: number): ColorIR =>
  normalized(channel("red", red), channel("green", green), channel("blue", blue), 1);

export const rgba = (red: number, green: number, blue: number, alpha: number): ColorIR =>
  normalized(
    channel("red", red),
    channel("green", green),
    channel("blue", blue),
    alphaChannel(alpha),
  );

export function hex(value: string): ColorIR {
  const match = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(value);
  if (!match) throw new TypeError("hex color must use #rgb, #rgba, #rrggbb, or #rrggbbaa");
  const digits = match[1] ?? "";
  const expanded =
    digits.length <= 4
      ? digits.replace(/[0-9a-f]/gi, (digit) => digit.repeat(2))
      : digits.toLowerCase();
  const withAlpha = expanded.length === 6 ? `${expanded}ff` : expanded;
  return rgba(
    Number.parseInt(withAlpha.slice(0, 2), 16),
    Number.parseInt(withAlpha.slice(2, 4), 16),
    Number.parseInt(withAlpha.slice(4, 6), 16),
    Number.parseInt(withAlpha.slice(6, 8), 16) / 255,
  );
}

const transparent = rgba(0, 0, 0, 0);
const namedColors: Readonly<Record<string, ColorIR>> = Object.freeze({
  black: rgb(0, 0, 0),
  blue: rgb(0, 0, 255),
  green: rgb(0, 128, 0),
  red: rgb(255, 0, 0),
  transparent,
  white: rgb(255, 255, 255),
});

export function normalizeColor(value: ColorInput): ColorIR {
  if (typeof value !== "string") return value;
  if (value === "none") return transparent;
  if (value.startsWith("#")) return hex(value);
  const color = namedColors[value.toLowerCase()];
  if (!color)
    throw new TypeError(`Unsupported named color \`${value}\`; use rgb(), rgba(), or hex().`);
  return color;
}
