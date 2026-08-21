import { audioClipDuration, type AudioClipIR, type ExperienceIR } from "@eac/ir";
import { sec } from "@eac/units";
import { error, type Diagnostic } from "./diagnostic.js";

const finite = (value: number): boolean => Number.isFinite(value);

function assetDiagnostics(sceneId: string, clip: AudioClipIR): Diagnostic[] {
  const where = `${sceneId}.audio.${clip.id}.asset`;
  if (clip.asset.kind === "local")
    return [
      error(
        "eac::audio::missing-asset",
        `Audio clip \`${clip.id}\` has an unresolved local asset.`,
        `${where} (${clip.asset.path})`,
        "Local audio must be resolved relative to the project before checking or rendering.",
        ["run the project through the eac CLI", "verify the WAV path is project-relative"],
      ),
    ];
  if (clip.asset.kind === "invalid-audio")
    return [
      error(
        clip.asset.reason === "missing"
          ? "eac::audio::missing-asset"
          : "eac::audio::unsupported-asset",
        `Audio clip \`${clip.id}\` could not load \`${clip.asset.path}\`.`,
        where,
        clip.asset.detail,
        ["use a readable local PCM or float WAV", "keep the asset inside the project"],
      ),
    ];
  if (
    !["audio/wav"].includes(clip.asset.mimeType) ||
    clip.asset.data.length === 0 ||
    !finite(clip.asset.duration.value) ||
    clip.asset.duration.value <= 0
  )
    return [
      error(
        "eac::audio::unsupported-asset",
        `Audio clip \`${clip.id}\` has invalid embedded WAV data.`,
        where,
        "Embedded audio requires non-empty WAV bytes and a positive finite source duration.",
        ["resolve the original local WAV again"],
      ),
    ];
  return [];
}

function trimDiagnostics(sceneId: string, clip: AudioClipIR): Diagnostic[] {
  const sourceDuration =
    clip.asset.kind === "embedded-audio" ? clip.asset.duration.value : undefined;
  const trimEnd = clip.trimEnd?.value;
  const invalidTrim =
    !finite(clip.trimStart.value) ||
    clip.trimStart.value < 0 ||
    (trimEnd !== undefined &&
      (!finite(trimEnd) ||
        trimEnd <= clip.trimStart.value ||
        (sourceDuration !== undefined && trimEnd > sourceDuration))) ||
    (sourceDuration !== undefined && clip.trimStart.value >= sourceDuration);
  if (!invalidTrim) return [];
  return [
    error(
      "eac::audio::invalid-trim",
      `Audio clip \`${clip.id}\` has an invalid trim interval.`,
      `${sceneId}.audio.${clip.id}.trim`,
      "Trim bounds must be finite, ordered, non-negative, and inside known source media bounds.",
      ["move trim.start before trim.end", "keep trim bounds within the source WAV duration"],
    ),
  ];
}

function rangeDiagnostics(sceneId: string, sceneDuration: number, clip: AudioClipIR): Diagnostic[] {
  const duration = audioClipDuration(clip);
  const sourceDuration =
    clip.asset.kind === "embedded-audio" ? clip.asset.duration.value : undefined;
  const availableEnd = clip.trimEnd?.value ?? sourceDuration;
  const exceedsSource =
    duration !== undefined &&
    availableEnd !== undefined &&
    clip.trimStart.value + duration > availableEnd;
  const invalidFade =
    !finite(clip.fadeIn.value) ||
    !finite(clip.fadeOut.value) ||
    clip.fadeIn.value < 0 ||
    clip.fadeOut.value < 0 ||
    (duration !== undefined && clip.fadeIn.value + clip.fadeOut.value > duration);
  const invalidTimeline =
    !finite(clip.start.value) ||
    clip.start.value < 0 ||
    duration === undefined ||
    !finite(duration) ||
    duration <= 0 ||
    clip.start.value + duration > sceneDuration;
  if (!invalidTimeline && !exceedsSource && !invalidFade) return [];
  return [
    error(
      "eac::audio::invalid-range",
      `Audio clip \`${clip.id}\` has an invalid playback range.`,
      `${sceneId}.audio.${clip.id}`,
      "Playback must fit the scene and source media; non-negative fades must fit the clip.",
      ["adjust at or duration", "shorten the trim", "shorten fadeIn or fadeOut"],
    ),
  ];
}

export function runAudioRules(experience: ExperienceIR): Diagnostic[] {
  const sounds = experience.scenes.flatMap((scene) =>
    scene.reactive.sounds.flatMap((sound) => [
      // An event sound has no start time; only its asset, volume, and trim can be checked here.
      ...assetDiagnostics(scene.id, { ...sound, start: sec(0) }),
      ...(Number.isFinite(sound.volume) && sound.volume >= 0 && sound.volume <= 1
        ? []
        : [
            error(
              "eac::audio::invalid-volume",
              `Sound \`${sound.id}\` has invalid volume \`${String(sound.volume)}\`.`,
              `${scene.id}.sound.${sound.id}.volume`,
              "Deterministic clip volume is a finite number from 0 through 1.",
              ["set volume between 0 and 1"],
            ),
          ]),
      ...trimDiagnostics(scene.id, { ...sound, start: sec(0) }),
    ]),
  );
  return sounds.concat(
    experience.scenes.flatMap((scene) =>
      scene.audioClips.flatMap((clip) => [
        ...assetDiagnostics(scene.id, clip),
        ...(finite(clip.volume) && clip.volume >= 0 && clip.volume <= 1
          ? []
          : [
              error(
                "eac::audio::invalid-volume",
                `Audio clip \`${clip.id}\` has invalid volume \`${String(clip.volume)}\`.`,
                `${scene.id}.audio.${clip.id}.volume`,
                "Deterministic clip volume is a finite number from 0 through 1.",
                ["set volume between 0 and 1"],
              ),
            ]),
        ...trimDiagnostics(scene.id, clip),
        ...rangeDiagnostics(scene.id, scene.duration.value, clip),
      ]),
    ),
  );
}
