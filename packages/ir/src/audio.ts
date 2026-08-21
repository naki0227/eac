import type { AudioClipIR } from "./types.js";

export function audioClipDuration(clip: AudioClipIR): number | undefined {
  if (clip.duration !== undefined) return clip.duration.value;
  if (clip.asset.kind !== "embedded-audio") return undefined;
  return (clip.trimEnd?.value ?? clip.asset.duration.value) - clip.trimStart.value;
}
