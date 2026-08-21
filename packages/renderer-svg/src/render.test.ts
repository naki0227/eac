import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { experience, px, sec } from "@eac/core";
import { describe, expect, it } from "vitest";
import type { AudioClipIR } from "@eac/ir";
import { buildEncodeArguments, renderPngSequence } from "./index.js";

function project() {
  const builder = experience({
    name: "sequence",
    width: px(16),
    height: px(16),
    duration: sec(0.1),
    fps: 20,
  });
  builder
    .scene("main")
    .circle("dot", { position: { x: px(8), y: px(8) }, radius: px(4), fill: "red" });
  return builder.build();
}

describe("PNG sequence renderer", () => {
  it("renders deterministic frame names with bounded concurrency", async () => {
    const directory = await mkdtemp(join(tmpdir(), "eac-render-sequence-"));
    try {
      expect(await renderPngSequence(project(), directory, { concurrency: 2 })).toBe(2);
      expect(await readdir(directory)).toEqual(["frame-000000.png", "frame-000001.png"]);
      expect([...(await readFile(join(directory, "frame-000001.png"))).subarray(1, 4)]).toEqual([
        80, 78, 71,
      ]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects invalid concurrency", async () => {
    await expect(renderPngSequence(project(), tmpdir(), { concurrency: 0 })).rejects.toThrow(
      "positive integer",
    );
  });

  it("builds deterministic ffmpeg audio trim, fade, delay, and mix arguments", () => {
    const clip: AudioClipIR = {
      id: "sting",
      asset: {
        kind: "embedded-audio",
        path: "sting.wav",
        mimeType: "audio/wav",
        data: "UklGRg==",
        duration: sec(2),
      },
      start: sec(0.5),
      duration: sec(1),
      trimStart: sec(0.25),
      volume: 0.8,
      fadeIn: sec(0.1),
      fadeOut: sec(0.2),
    };
    const args = buildEncodeArguments(
      "/frames",
      30,
      "/output.mp4",
      [{ path: "/audio.wav", clip, start: 1.5, duration: 1 }],
      3,
    );
    const filter = args[args.indexOf("-filter_complex") + 1];
    expect(filter).toContain("atrim=start=0.25:duration=1");
    expect(filter).toContain("volume=0.8");
    expect(filter).toContain("afade=t=in:st=0:d=0.1");
    expect(filter).toContain("afade=t=out:st=0.8:d=0.2");
    expect(filter).toContain("adelay=1500:all=1");
    expect(filter).toContain("amix=inputs=1");
    expect(args).toEqual(expect.arrayContaining(["-map", "[eac-audio]", "-c:a", "aac"]));
  });
});
