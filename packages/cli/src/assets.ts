import { readFile, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import type {
  AssetIR,
  AudioAssetIR,
  AudioClipIR,
  EmbeddedAssetIR,
  ExperienceIR,
  InvalidAssetIR,
  InvalidAudioAssetIR,
  NodeIR,
} from "@eac/ir";
import { sec } from "@eac/core";

const MAX_ASSET_BYTES = 20 * 1024 * 1024;

const invalid = (
  path: string,
  reason: InvalidAssetIR["reason"],
  detail: string,
): InvalidAssetIR => ({ kind: "invalid", path, reason, detail });

const invalidAudio = (
  path: string,
  reason: InvalidAudioAssetIR["reason"],
  detail: string,
): InvalidAudioAssetIR => ({ kind: "invalid-audio", path, reason, detail });

function pngDimensions(data: Buffer): readonly [number, number] | undefined {
  const signature = "89504e470d0a1a0a";
  if (data.length < 24 || data.subarray(0, 8).toString("hex") !== signature) return undefined;
  return [data.readUInt32BE(16), data.readUInt32BE(20)];
}

function jpegDimensions(data: Buffer): readonly [number, number] | undefined {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) return undefined;
  let offset = 2;
  const startOfFrame = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
  ]);
  while (offset + 8 < data.length) {
    if (data[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = data[offset + 1];
    if (marker === undefined) return undefined;
    if (marker === 0xd9 || marker === 0xda) return undefined;
    const length = data.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > data.length) return undefined;
    if (startOfFrame.has(marker))
      return [data.readUInt16BE(offset + 7), data.readUInt16BE(offset + 5)];
    offset += 2 + length;
  }
  return undefined;
}

function svgDimensions(data: Buffer): readonly [number, number] | undefined {
  const source = data.toString("utf8");
  if (
    !/<svg\b/i.test(source) ||
    /<(?:script|foreignObject)\b/i.test(source) ||
    /<!DOCTYPE\b/i.test(source) ||
    /\son[a-z]+\s*=/i.test(source) ||
    /@import\b/i.test(source) ||
    /(?:href|xlink:href)\s*=\s*["'](?!#|data:)/i.test(source) ||
    /url\(\s*["']?(?:https?:|file:|\/)/i.test(source)
  )
    return undefined;
  const tag = /<svg\b[^>]*>/i.exec(source)?.[0];
  if (!tag) return undefined;
  const numeric = (name: string): number | undefined => {
    const value = new RegExp(`${name}\\s*=\\s*["']([0-9]+(?:\\.[0-9]+)?)(?:px)?["']`, "i").exec(
      tag,
    )?.[1];
    return value === undefined ? undefined : Number(value);
  };
  const width = numeric("width");
  const height = numeric("height");
  if (width !== undefined && height !== undefined) return [width, height];
  const viewBox =
    /viewBox\s*=\s*["']\s*[-+\d.]+[ ,]+[-+\d.]+[ ,]+([-+\d.]+)[ ,]+([-+\d.]+)\s*["']/i.exec(tag);
  return viewBox ? [Number(viewBox[1]), Number(viewBox[2])] : undefined;
}

function inspectImage(
  data: Buffer,
): Pick<EmbeddedAssetIR, "mimeType" | "intrinsicWidth" | "intrinsicHeight"> | undefined {
  const png = pngDimensions(data);
  if (png) return { mimeType: "image/png", intrinsicWidth: png[0], intrinsicHeight: png[1] };
  const jpeg = jpegDimensions(data);
  if (jpeg) return { mimeType: "image/jpeg", intrinsicWidth: jpeg[0], intrinsicHeight: jpeg[1] };
  const svg = svgDimensions(data);
  if (svg) return { mimeType: "image/svg+xml", intrinsicWidth: svg[0], intrinsicHeight: svg[1] };
  return undefined;
}

function wavDuration(data: Buffer): number | undefined {
  if (
    data.length < 44 ||
    data.subarray(0, 4).toString("ascii") !== "RIFF" ||
    data.subarray(8, 12).toString("ascii") !== "WAVE"
  )
    return undefined;
  let offset = 12;
  let byteRate: number | undefined;
  let dataSize: number | undefined;
  while (offset + 8 <= data.length) {
    const id = data.subarray(offset, offset + 4).toString("ascii");
    const size = data.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (start + size > data.length) return undefined;
    if (id === "fmt " && size >= 16) {
      const format = data.readUInt16LE(start);
      if (![1, 3].includes(format)) return undefined;
      byteRate = data.readUInt32LE(start + 8);
    }
    if (id === "data") dataSize = size;
    offset = start + size + (size % 2);
  }
  if (byteRate === undefined || dataSize === undefined || byteRate <= 0 || dataSize <= 0)
    return undefined;
  const duration = dataSize / byteRate;
  return Number.isFinite(duration) && duration > 0 ? duration : undefined;
}

async function resolveAsset(asset: AssetIR, root: string): Promise<AssetIR> {
  if (asset.kind !== "local") return asset;
  const target = resolve(root, asset.path);
  const lexicalRelative = relative(root, target);
  if (isAbsolute(lexicalRelative) || lexicalRelative.startsWith(".."))
    return invalid(asset.path, "invalid-reference", "asset path escapes the project root");
  let canonicalTarget: string;
  try {
    canonicalTarget = await realpath(target);
  } catch {
    return invalid(asset.path, "missing", "asset file does not exist or is unreadable");
  }
  const canonicalRoot = await realpath(root);
  const canonicalRelative = relative(canonicalRoot, canonicalTarget);
  if (isAbsolute(canonicalRelative) || canonicalRelative.startsWith(".."))
    return invalid(asset.path, "invalid-reference", "asset symlink escapes the project root");
  const data = await readFile(canonicalTarget);
  if (data.byteLength > MAX_ASSET_BYTES)
    return invalid(asset.path, "unsupported-format", "asset exceeds the 20 MiB safety limit");
  const inspected = inspectImage(data);
  if (!inspected)
    return invalid(asset.path, "unsupported-format", "expected a safe PNG, JPEG, or SVG image");
  if (
    !Number.isFinite(inspected.intrinsicWidth) ||
    !Number.isFinite(inspected.intrinsicHeight) ||
    inspected.intrinsicWidth <= 0 ||
    inspected.intrinsicHeight <= 0
  )
    return invalid(
      asset.path,
      "invalid-dimensions",
      "image dimensions must be positive and finite",
    );
  return { kind: "embedded", path: asset.path, data: data.toString("base64"), ...inspected };
}

async function resolveAudioAsset(asset: AudioAssetIR, root: string): Promise<AudioAssetIR> {
  if (asset.kind !== "local") return asset;
  const target = resolve(root, asset.path);
  const lexicalRelative = relative(root, target);
  if (isAbsolute(lexicalRelative) || lexicalRelative.startsWith(".."))
    return invalidAudio(asset.path, "invalid-reference", "audio path escapes the project root");
  let canonicalTarget: string;
  try {
    canonicalTarget = await realpath(target);
  } catch {
    return invalidAudio(asset.path, "missing", "audio file does not exist or is unreadable");
  }
  const canonicalRoot = await realpath(root);
  const canonicalRelative = relative(canonicalRoot, canonicalTarget);
  if (isAbsolute(canonicalRelative) || canonicalRelative.startsWith(".."))
    return invalidAudio(asset.path, "invalid-reference", "audio symlink escapes the project root");
  const data = await readFile(canonicalTarget);
  if (data.byteLength > MAX_ASSET_BYTES)
    return invalidAudio(asset.path, "unsupported-format", "audio exceeds the 20 MiB safety limit");
  const duration = wavDuration(data);
  if (duration === undefined)
    return invalidAudio(asset.path, "unsupported-format", "expected a valid PCM or float WAV file");
  return {
    kind: "embedded-audio",
    path: asset.path,
    mimeType: "audio/wav",
    data: data.toString("base64"),
    duration: sec(duration),
  };
}

async function resolveAudioClip(clip: AudioClipIR, root: string): Promise<AudioClipIR> {
  return { ...clip, asset: await resolveAudioAsset(clip.asset, root) };
}

async function resolveNode(node: NodeIR, root: string): Promise<NodeIR> {
  if (node.kind === "group")
    return {
      ...node,
      children: await Promise.all(node.children.map((child) => resolveNode(child, root))),
    };
  if (node.geometry.kind !== "image") return node;
  return {
    ...node,
    geometry: { ...node.geometry, asset: await resolveAsset(node.geometry.asset, root) },
  };
}

export async function resolveProjectAssets(
  experience: ExperienceIR,
  projectRoot: string,
): Promise<ExperienceIR> {
  return {
    ...experience,
    scenes: await Promise.all(
      experience.scenes.map(async (scene) => ({
        ...scene,
        nodes: await Promise.all(scene.nodes.map((node) => resolveNode(node, projectRoot))),
        audioClips: await Promise.all(
          scene.audioClips.map((clip) => resolveAudioClip(clip, projectRoot)),
        ),
      })),
    ),
  };
}
