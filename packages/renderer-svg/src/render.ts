import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import type { ExperienceIR } from "@eac/ir";
import { Resvg } from "@resvg/resvg-js";
import { renderSvg } from "./svg.js";

const execFileAsync = promisify(execFile);

export function renderPng(experience: ExperienceIR, time: number): Uint8Array {
  return new Resvg(renderSvg(experience, time), { fitTo: { mode: "original" } }).render().asPng();
}

export async function renderPngSequence(
  experience: ExperienceIR,
  directory: string,
): Promise<number> {
  await mkdir(directory, { recursive: true });
  const frames = Math.ceil(experience.duration.value * experience.fps);
  const digits = Math.max(6, String(frames).length);
  for (let frame = 0; frame < frames; frame++) {
    const name = `frame-${String(frame).padStart(digits, "0")}.png`;
    await writeFile(join(directory, name), renderPng(experience, frame / experience.fps));
  }
  return frames;
}

export async function encodeMp4(
  frameDirectory: string,
  fps: number,
  output: string,
): Promise<void> {
  await execFileAsync("ffmpeg", [
    "-y",
    "-framerate",
    String(fps),
    "-i",
    join(frameDirectory, "frame-%06d.png"),
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    output,
  ]);
}
