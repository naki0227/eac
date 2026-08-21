# ADR 0001: TypeScript monorepo and SVG-first rendering

## Status

Accepted for v0.1.

## Context and problem

EaC needs a small unit-aware DSL, a platform-neutral IR, deterministic seeking, isolated validation,
and visible outputs that coding agents can exercise from a CLI.

## Options considered

1. TypeScript workspaces with a neutral IR and SVG renderer.
2. One TypeScript package with all responsibilities combined.
3. Rust core with TypeScript bindings.
4. React/Remotion as the timeline and rendering runtime.

## Decision

Use strict TypeScript project references and pnpm workspaces. Separate units, IR, DSL, checker,
renderer, and CLI packages. Render SVG directly, rasterize through resvg, and encode PNG sequences
with ffmpeg. Use cubic Bézier as the single Bézier representation.

## Reasons and benefits

- Type declarations are directly useful to the agent-learning experiment.
- Package boundaries make dependency direction, unit testing, and future replacement explicit.
- SVG supports deterministic text-based frame inspection without Chromium or React.
- resvg gives consistent PNG output; ffmpeg keeps video encoding outside the core model.

## Drawbacks

- Monorepo configuration is heavier than a single package.
- Native resvg binaries add a distribution and maintenance consideration.
- SVG text metrics and AABB checks are approximate.
- TypeScript runtime input still requires explicit validation after loading untrusted JSON IR.

## Revisit conditions

Re-evaluate the renderer boundary once a second renderer is implemented. Reconsider a native core only
if measured performance or portability requirements cannot be met by TypeScript.
