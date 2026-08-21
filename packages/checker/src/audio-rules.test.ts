import { experience, px, sec } from "@eac/core";
import type { AudioClipIR, ExperienceIR } from "@eac/ir";
import { describe, expect, it } from "vitest";
import { checkExperience } from "./index.js";

const ids = (value: ExperienceIR): readonly string[] =>
  checkExperience(value).diagnostics.map(({ id }) => id);

function withEmbeddedAudio(clip: AudioClipIR): ExperienceIR {
  const project = experience({
    name: "audio",
    width: px(100),
    height: px(100),
    duration: sec(3),
  });
  const scene = project.scene("main");
  scene.audio("sound.wav", { at: sec(1), duration: sec(1) });
  const built = project.build();
  const builtScene = built.scenes[0];
  if (!builtScene) throw new Error("Expected scene in audio test fixture.");
  return {
    ...built,
    scenes: [{ ...builtScene, audioClips: [clip] }],
  };
}

const validClip: AudioClipIR = {
  id: "sting",
  asset: {
    kind: "embedded-audio",
    path: "sound.wav",
    mimeType: "audio/wav",
    data: "UklGRg==",
    duration: sec(2),
  },
  start: sec(1),
  duration: sec(1),
  trimStart: sec(0.25),
  volume: 0.8,
  fadeIn: sec(0.1),
  fadeOut: sec(0.1),
};

describe("audio checker", () => {
  it("accepts an embedded clip with bounded trim and fades", () => {
    expect(ids(withEmbeddedAudio(validClip))).not.toEqual(
      expect.arrayContaining([
        "eac::audio::missing-asset",
        "eac::audio::invalid-range",
        "eac::audio::invalid-volume",
      ]),
    );
  });

  it("reports unresolved assets, invalid trim, volume, and playback bounds", () => {
    const project = experience({
      name: "audio",
      width: px(100),
      height: px(100),
      duration: sec(1),
    });
    project.scene("main").audio("missing.wav", {
      at: sec(0.75),
      duration: sec(1),
      trim: { start: sec(1), end: sec(0.5) },
      volume: 2,
      fadeIn: sec(0.8),
      fadeOut: sec(0.8),
    });
    expect(ids(project.build())).toEqual(
      expect.arrayContaining([
        "eac::audio::missing-asset",
        "eac::audio::invalid-trim",
        "eac::audio::invalid-volume",
        "eac::audio::invalid-range",
      ]),
    );
  });

  it("rejects playback beyond known source media bounds", () => {
    expect(
      ids(withEmbeddedAudio({ ...validClip, duration: sec(2), trimStart: sec(0.5) })),
    ).toContain("eac::audio::invalid-range");
  });
});
