import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { availableParallelism } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { Worker } from "node:worker_threads";
import type { ExperienceIR } from "@eac/ir";
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
