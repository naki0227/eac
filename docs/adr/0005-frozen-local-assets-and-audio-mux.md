# ADR 0005: Resolve frozen local assets at the CLI boundary and mux audio with ffmpeg

## Background

v0.2 adds images and audio. v0.1 semantics were pure: the IR described geometry and time, and no
package read the filesystem or interpreted media. Images and audio both need real bytes, real
intrinsic dimensions, and — for audio — a real source duration before anything can be checked or
rendered.

## Problem

Media must enter a deterministic system without giving core semantics filesystem access, without
turning the checker into a media decoder, and without adding a large media dependency whose behavior
we cannot pin.

## Options

1. Let core read files during `build()` so assets are always resolved.
2. Let the renderer read files lazily while lowering.
3. Resolve assets once at the CLI/project boundary into frozen embedded records, and add a full
   media decoding dependency to read metadata.
4. Resolve assets once at the CLI/project boundary into frozen embedded records, and parse only the
   minimum container metadata we need locally.

## Decision

Adopt option 4.

`resolveProjectAssets` runs at the CLI/project boundary and converts every `local` asset into an
`embedded` (image) or `embedded-audio` record carrying MIME type, base64 bytes, and the metadata the
system needs — intrinsic dimensions for images, source duration for audio. Unresolvable assets become
explicit `invalid` / `invalid-audio` records with a reason rather than throwing.

Audio is restricted to project-relative WAV. We parse RIFF chunks for PCM (format 1) and float
(format 3) directly and compute duration from byte rate and data size. Audio clips are scene timeline
records, never visual nodes. `eac render` muxes checked clips into the MP4 through ffmpeg using
`atrim`, `volume`, `afade`, `adelay`, and `amix`, padded and trimmed to the experience duration. The
argument vector is produced by a pure `buildEncodeArguments` function.

Path safety is uniform for images and audio: the path must stay inside the project root lexically and
after `realpath`, remote URLs are rejected, and anything over 20 MiB is rejected.

## Reasons

- Core and the checker stay pure and testable; only the CLI touches the filesystem.
- Frozen embedded records keep evaluation deterministic and independent of later filesystem changes.
- WAV container parsing is a few dozen reviewable lines; a decoding dependency would be a much larger
  supply-chain and behavior-pinning cost for metadata we barely need.
- A pure argument builder makes the ffmpeg contract unit-testable without invoking ffmpeg.
- Explicit invalid records let the checker produce repair guidance instead of a renderer stack trace.

## Benefits

- Assets and audio share one safety boundary and one failure representation.
- Audio timing, trim, volume, and fades are checked before any encoder runs.
- No new runtime dependency; ffmpeg was already the MP4 boundary.
- The MP4 audio track is reproducible from the same source bytes.

## Drawbacks

- Only WAV is supported; compressed sources must be converted by the author first.
- Base64 embedding inflates in-memory IR for large assets, bounded by the 20 MiB limit.
- Clip-bound checks are limited to what WAV headers state; malformed-but-parsable files are trusted.
- The HTML preview cannot play audio, so audio is only verifiable through a full MP4 render.

## Revisit conditions

Revisit when a second renderer needs a different asset representation, when compressed audio or
multi-track mixing is required, or when preview needs real audio playback. Any such change must keep
the frozen-record boundary and must not move filesystem access into core.
