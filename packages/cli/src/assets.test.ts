import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { experience, px, sec } from "@eac/core";
import type { AssetIR, AudioAssetIR, ExperienceIR } from "@eac/ir";
import { resolveProjectAssets } from "./assets.js";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function temporary(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "eac-assets-"));
  directories.push(directory);
  return directory;
}

function imageAsset(experienceIr: ExperienceIR): AssetIR {
  const node = experienceIr.scenes[0]?.nodes[0];
  if (node?.kind !== "object" || node.geometry.kind !== "image")
    throw new Error("Expected image in test fixture.");
  return node.geometry.asset;
}

function project(path: string): ExperienceIR {
  const value = experience({ name: "asset", width: px(100), height: px(100), duration: sec(1) });
  value.scene("main").image("image", {
    src: path,
    position: { x: px(50), y: px(50) },
    width: px(40),
    height: px(40),
  });
  return value.build();
}

function audioProject(path: string): ExperienceIR {
  const value = experience({ name: "audio", width: px(100), height: px(100), duration: sec(2) });
  value.scene("main").audio(path, { at: sec(0.5) });
  return value.build();
}

function audioAsset(experienceIr: ExperienceIR): AudioAssetIR {
  const value = experienceIr.scenes[0]?.audioClips[0]?.asset;
  if (!value) throw new Error("Expected audio in test fixture.");
  return value;
}

function oneSecondWav(): Buffer {
  const samples = 8_000;
  const dataSize = samples * 2;
  const wav = Buffer.alloc(44 + dataSize);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8_000, 24);
  wav.writeUInt32LE(16_000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(dataSize, 40);
  return wav;
}

describe("CLI asset resolution", () => {
  it("embeds a safe local SVG with intrinsic dimensions", async () => {
    const root = await temporary();
    await writeFile(
      join(root, "image.svg"),
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="12"><rect width="24" height="12"/></svg>',
    );
    const resolved = await resolveProjectAssets(project("image.svg"), root);
    expect(imageAsset(resolved)).toEqual(
      expect.objectContaining({
        kind: "embedded",
        mimeType: "image/svg+xml",
        intrinsicWidth: 24,
        intrinsicHeight: 12,
      }),
    );
  });

  it("detects PNG and JPEG dimensions from frozen local bytes", async () => {
    const root = await temporary();
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    );
    await writeFile(join(root, "pixel.png"), png);
    const jpeg = Buffer.alloc(23);
    Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x01, 0x00, 0x02, 0x03]).copy(
      jpeg,
    );
    jpeg[21] = 0xff;
    jpeg[22] = 0xd9;
    await writeFile(join(root, "pixel.jpg"), jpeg);

    expect(imageAsset(await resolveProjectAssets(project("pixel.png"), root))).toEqual(
      expect.objectContaining({
        kind: "embedded",
        mimeType: "image/png",
        intrinsicWidth: 1,
        intrinsicHeight: 1,
      }),
    );
    expect(imageAsset(await resolveProjectAssets(project("pixel.jpg"), root))).toEqual(
      expect.objectContaining({
        kind: "embedded",
        mimeType: "image/jpeg",
        intrinsicWidth: 2,
        intrinsicHeight: 1,
      }),
    );
  });

  it("classifies missing, unsupported, unsafe, and invalid-dimension files", async () => {
    const root = await temporary();
    await writeFile(join(root, "plain.txt"), "not an image");
    await writeFile(
      join(root, "unsafe.svg"),
      '<svg width="10" height="10"><script>alert(1)</script></svg>',
    );
    const invalidPng = Buffer.alloc(24);
    Buffer.from("89504e470d0a1a0a", "hex").copy(invalidPng);
    invalidPng.writeUInt32BE(0, 16);
    invalidPng.writeUInt32BE(1, 20);
    await writeFile(join(root, "zero.png"), invalidPng);

    expect(imageAsset(await resolveProjectAssets(project("missing.png"), root))).toEqual(
      expect.objectContaining({ kind: "invalid", reason: "missing" }),
    );
    for (const path of ["plain.txt", "unsafe.svg"])
      expect(imageAsset(await resolveProjectAssets(project(path), root))).toEqual(
        expect.objectContaining({ kind: "invalid", reason: "unsupported-format" }),
      );
    expect(imageAsset(await resolveProjectAssets(project("zero.png"), root))).toEqual(
      expect.objectContaining({ kind: "invalid", reason: "invalid-dimensions" }),
    );
  });

  it("rejects symlinks that escape the project root", async () => {
    const root = await temporary();
    const outside = await temporary();
    const target = join(outside, "outside.svg");
    await writeFile(target, '<svg width="10" height="10"></svg>');
    await symlink(target, join(root, "linked.svg"));

    expect(imageAsset(await resolveProjectAssets(project("linked.svg"), root))).toEqual(
      expect.objectContaining({ kind: "invalid", reason: "invalid-reference" }),
    );
  });

  it("embeds a valid frozen WAV with deterministic duration metadata", async () => {
    const root = await temporary();
    await writeFile(join(root, "sting.wav"), oneSecondWav());

    expect(audioAsset(await resolveProjectAssets(audioProject("sting.wav"), root))).toEqual(
      expect.objectContaining({
        kind: "embedded-audio",
        mimeType: "audio/wav",
        duration: sec(1),
      }),
    );
  });

  it("classifies missing and unsupported audio assets", async () => {
    const root = await temporary();
    await writeFile(join(root, "noise.wav"), "not wav bytes");

    expect(audioAsset(await resolveProjectAssets(audioProject("missing.wav"), root))).toEqual(
      expect.objectContaining({ kind: "invalid-audio", reason: "missing" }),
    );
    expect(audioAsset(await resolveProjectAssets(audioProject("noise.wav"), root))).toEqual(
      expect.objectContaining({ kind: "invalid-audio", reason: "unsupported-format" }),
    );
  });
});
