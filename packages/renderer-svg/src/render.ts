import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { availableParallelism } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { Worker } from "node:worker_threads";
import { audioClipDuration, type AudioClipIR, type ExperienceIR } from "@eac/ir";
import { Resvg } from "@resvg/resvg-js";
import { renderSvg } from "./svg.js";

const execFileAsync = promisify(execFile);
const resvgUrl = pathToFileURL(createRequire(import.meta.url).resolve("@resvg/resvg-js")).href;
const rasterWorkerSource = `
import { parentPort, workerData } from "node:worker_threads";
import { writeFile } from "node:fs/promises";
const resvg = import(workerData.resvgUrl);
parentPort.on("message", async (task) => {
  try {
    const { Resvg } = await resvg;
    const png = new Resvg(task.svg, { fitTo: { mode: "original" } }).render().asPng();
    await writeFile(task.output, png);
    parentPort.postMessage({ frame: task.frame });
  } catch (cause) {
    parentPort.postMessage({
      frame: task.frame,
      error: cause instanceof Error ? cause.message : String(cause),
    });
  }
});`;
const rasterWorkerUrl = new URL(`data:text/javascript,${encodeURIComponent(rasterWorkerSource)}`);

type RasterResult = Readonly<{ frame: number; error?: string }>;
export type RenderSequenceOptions = Readonly<{ concurrency?: number }>;
export type EncodeMp4Options = Readonly<{ experience?: ExperienceIR }>;
type AudioInput = Readonly<{
  path: string;
  clip: AudioClipIR;
  start: number;
  duration: number;
}>;

function isRasterResult(value: unknown): value is RasterResult {
  if (typeof value !== "object" || value === null) return false;
  const result = value as { frame?: unknown; error?: unknown };
  return (
    typeof result.frame === "number" &&
    (result.error === undefined || typeof result.error === "string")
  );
}

export function renderPng(experience: ExperienceIR, time: number): Uint8Array {
  return new Resvg(renderSvg(experience, time), { fitTo: { mode: "original" } }).render().asPng();
}

export async function renderPngSequence(
  experience: ExperienceIR,
  directory: string,
  options: RenderSequenceOptions = {},
): Promise<number> {
  await mkdir(directory, { recursive: true });
  const frames = Math.ceil(experience.duration.value * experience.fps);
  const digits = Math.max(6, String(frames).length);
  const requestedConcurrency = options.concurrency ?? Math.min(availableParallelism(), 4);
  if (!Number.isInteger(requestedConcurrency) || requestedConcurrency <= 0)
    throw new RangeError("render concurrency must be a positive integer");
  const workerCount = Math.min(frames, requestedConcurrency);
  const workers = Array.from(
    { length: workerCount },
    () =>
      new Worker(rasterWorkerUrl, {
        name: "eac-png-renderer",
        workerData: { resvgUrl },
      }),
  );
  return new Promise<number>((resolve, reject) => {
    let nextFrame = 0;
    let completed = 0;
    let settled = false;

    const terminate = (): Promise<number[]> =>
      Promise.all(workers.map((worker) => worker.terminate()));
    const fail = (cause: unknown): void => {
      if (settled) return;
      settled = true;
      const error = cause instanceof Error ? cause : new Error(String(cause));
      void terminate().finally(() => reject(error));
    };
    const finish = (): void => {
      settled = true;
      void terminate().then(() => resolve(frames), reject);
    };
    const dispatch = (worker: Worker): void => {
      if (settled || nextFrame >= frames) return;
      const frame = nextFrame++;
      const name = `frame-${String(frame).padStart(digits, "0")}.png`;
      worker.postMessage({
        frame,
        svg: renderSvg(experience, frame / experience.fps),
        output: join(directory, name),
      });
    };

    for (const worker of workers) {
      worker.on("message", (message: unknown) => {
        if (!isRasterResult(message))
          return fail(new Error("PNG worker returned an invalid result"));
        if (message.error !== undefined) return fail(new Error(message.error));
        completed++;
        if (completed === frames) finish();
        else dispatch(worker);
      });
      worker.on("error", fail);
      worker.on("exit", (code) => {
        if (!settled && code !== 0) fail(new Error(`PNG worker exited with code ${String(code)}`));
      });
      dispatch(worker);
    }
  });
}

const ffmpegNumber = (value: number): string => Number(value.toFixed(6)).toString();

export function buildEncodeArguments(
  frameDirectory: string,
  fps: number,
  output: string,
  audio: readonly AudioInput[] = [],
  totalDuration?: number,
): readonly string[] {
  const base = ["-y", "-framerate", String(fps), "-i", join(frameDirectory, "frame-%06d.png")];
  if (audio.length === 0)
    return [...base, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", output];
  if (totalDuration === undefined || !Number.isFinite(totalDuration) || totalDuration <= 0)
    throw new RangeError("audio muxing requires a positive finite experience duration");
  const inputs = audio.flatMap((item) => ["-i", item.path]);
  const clipFilters = audio.map((item, index) => {
    const fadeIn = item.clip.fadeIn.value;
    const fadeOut = item.clip.fadeOut.value;
    const filters = [
      `atrim=start=${ffmpegNumber(item.clip.trimStart.value)}:duration=${ffmpegNumber(item.duration)}`,
      "asetpts=PTS-STARTPTS",
      `volume=${ffmpegNumber(item.clip.volume)}`,
      ...(fadeIn > 0 ? [`afade=t=in:st=0:d=${ffmpegNumber(fadeIn)}`] : []),
      ...(fadeOut > 0
        ? [`afade=t=out:st=${ffmpegNumber(item.duration - fadeOut)}:d=${ffmpegNumber(fadeOut)}`]
        : []),
      `adelay=${ffmpegNumber(item.start * 1_000)}:all=1`,
    ];
    return `[${index + 1}:a]${filters.join(",")}[eac-audio-${index}]`;
  });
  // `normalize=0` keeps each clip at its authored volume; amix would otherwise divide every
  // input by the clip count, so adding a second clip would silently quieten the first.
  const mixInputs = audio.map((_, index) => `[eac-audio-${index}]`).join("");
  const mix = `${mixInputs}amix=inputs=${audio.length}:normalize=0:duration=longest:dropout_transition=0,apad=whole_dur=${ffmpegNumber(totalDuration)},atrim=duration=${ffmpegNumber(totalDuration)}[eac-audio]`;
  return [
    ...base,
    ...inputs,
    "-filter_complex",
    [...clipFilters, mix].join(";"),
    "-map",
    "0:v:0",
    "-map",
    "[eac-audio]",
    "-c:v",
    "libx264",
    "-c:a",
    "aac",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-shortest",
    output,
  ];
}

async function materializeAudio(
  experience: ExperienceIR,
  frameDirectory: string,
): Promise<readonly AudioInput[]> {
  const entries = experience.scenes.flatMap((scene) =>
    scene.audioClips.map((clip) => ({ clip, sceneStart: scene.start.value })),
  );
  return Promise.all(
    entries.map(async ({ clip, sceneStart }, index) => {
      if (clip.asset.kind !== "embedded-audio")
        throw new TypeError(`Audio asset \`${clip.asset.path}\` is not renderable.`);
      const duration = audioClipDuration(clip);
      if (duration === undefined || !Number.isFinite(duration) || duration <= 0)
        throw new RangeError(`Audio clip \`${clip.id}\` has no renderable duration.`);
      const path = join(frameDirectory, `eac-audio-${String(index).padStart(3, "0")}.wav`);
      await writeFile(path, Buffer.from(clip.asset.data, "base64"));
      return { path, clip, start: sceneStart + clip.start.value, duration };
    }),
  );
}

export async function encodeMp4(
  frameDirectory: string,
  fps: number,
  output: string,
  options: EncodeMp4Options = {},
): Promise<void> {
  const audio =
    options.experience === undefined
      ? []
      : await materializeAudio(options.experience, frameDirectory);
  await execFileAsync(
    "ffmpeg",
    buildEncodeArguments(frameDirectory, fps, output, audio, options.experience?.duration.value),
  );
}
