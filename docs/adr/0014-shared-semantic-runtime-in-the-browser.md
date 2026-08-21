# ADR 0014: One semantic runtime, running in the browser too

## Background

v0.3 shipped reactive semantics with a single evaluator, `ExperienceSession`, used by the checker,
the inspector, and the renderer. The HTML preview was the exception: it pre-rendered frames in Node
and, in the browser, only recorded input. A user could not see the reactive result while interacting.

## Problem

Live interaction needs reactive evaluation in the browser. The obvious route — writing a small
reactive evaluator in the preview's JavaScript — would create a second implementation of hover, hit
testing, click derivation, state transitions, and frame ordering. Two implementations of semantics
this subtle diverge, and the divergence would show up as "the preview did something the rendered
video does not".

## Options

1. Reimplement reactive evaluation in preview JavaScript.
2. Precompute every reachable state in Node and ship a lookup table.
3. Patch SVG attributes in the browser from a shipped table of per-node overrides.
4. Ship the actual `@eac/runtime` to the browser as a bundle and let the page drive it.
5. Run a local server so the browser can call Node for every frame.

## Decision

Adopt option 4.

The semantic core was already browser-safe: `@eac/units`, `@eac/ir`, and `@eac/runtime` contain no
Node imports. Two things were in the way, and neither was semantic:

- `@eac/renderer-svg`'s package entry re-exports the Node render pipeline (ffmpeg, resvg, workers,
  filesystem), so importing `renderSvg` from it dragged Node-only code in. Fixed by adding a `./svg`
  export subpath that exposes only the pure lowering function.
- Nothing bundled the workspace packages for a browser. Fixed with esbuild, producing one IIFE from
  the compiled output.

The browser therefore runs the same `ExperienceSession`, the same hit-testing, the same phase model,
and the same `renderSvg` as `eac check`, `eac inspect`, and `eac render`.

**Adapter boundary.** DOM events are input only. `@eac/runtime/browser` converts them to normalized
scenario payloads — coordinate conversion, key normalization, pointer coalescing — and nothing else.
The page never decides that a node was hovered or clicked; it forwards `pointerMove`, `pointerDown`,
and `pointerUp`, and the runtime derives the rest.

**Semantic clock.** Frame index is the source of truth: semantic time is `frame / fps`.
`requestAnimationFrame` decides _when_ to paint, never _what_ a frame contains. Live input is
buffered and committed at a frame boundary, so live interaction is quantized exactly like scenario
replay.

**One input stream.** `LiveSession` accumulates the committed events as an ordinary `ScenarioIR`.
The live session and the recording read the same stream, so an exported scenario is by construction
the interaction the user just had — and replaying it in a fresh session reproduces it frame for
frame.

Option 5 is rejected because the preview must work as a plain file with no server and no network.
Options 2 and 3 are rejected because hover depends on continuous pointer position, which cannot be
enumerated, and because patching attributes would reintroduce geometry logic in the page.

## Reasons

- The blockers were packaging, not semantics, so sharing the real runtime cost less than writing a
  second one would have.
- A conformance test can compare the shipped bundle against the Node session directly, which is only
  meaningful because they are the same code.
- Keeping the clock on the frame index means pause, seek, and frame-step stay exact under a
  scheduler that is inherently jittery.

## Benefits

- Live preview, recording, replay, and offline render share one definition of every semantic term.
- The preview is a single self-contained file: no server, no CDN, no network.
- A recorded interaction is directly usable as a checker fixture and as a render input.

## Drawbacks

- The preview page now carries a ~20 KiB runtime bundle, and `pnpm build` gained a bundling step.
- esbuild becomes a build-time dependency, pinned through the lockfile.
- Reactive evaluation runs per frame in the browser, so a very large scene is bounded by the
  browser's single thread rather than by Node's workers.
- The bundle must be rebuilt when the runtime changes; a stale bundle is a real failure mode, which
  is why the loader raises a specific error rather than silently shipping nothing.

## Revisit conditions

Revisit if the preview needs capabilities the pure lowering path cannot provide — real audio
playback, or rasterization in the browser. Neither may be met by adding a second evaluator.
