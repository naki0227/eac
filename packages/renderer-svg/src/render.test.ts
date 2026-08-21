import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { experience, px, sec } from "@eac/core";
import { describe, expect, it } from "vitest";
import { renderPngSequence } from "./index.js";

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
});
