# EaC — Experience as Code

> ⚠ Experimental
>
> EaC is currently an experimental runtime for studying how humans and coding agents can author
> deterministic, verifiable experiences as code. It is not yet a Remotion, Rive, After Effects,
> or production UI framework replacement.

**Code is the source. Experience is the output.** EaC v0.1 is a small TypeScript DSL, platform-neutral
IR, checker, and deterministic SVG renderer. Its primary research question is whether a coding agent
can learn an unfamiliar creative DSL from its CLI and converge on valid output through structured
diagnostics.

## Quick start

Requirements: Node.js 22+, pnpm 10, and ffmpeg for MP4 output.

```bash
corepack enable
pnpm install
pnpm build
pnpm eac help
pnpm eac check --ci examples/basic-motion/eac.config.mjs
pnpm eac preview examples/basic-motion/eac.config.mjs
pnpm eac render examples/basic-motion/eac.config.mjs --frame 30
```

Start with `eac help`; do not guess API names. Search by intent:

```bash
pnpm eac docs search "move along a cycloid"
pnpm eac docs moveTo
pnpm eac format examples/basic-motion/eac.config.mjs
```

## Small typed DSL

```js
import { experience, opacity, px, sec } from "@eac/core";

const project = experience({
  name: "hello-motion",
  width: px(1280),
  height: px(720),
  duration: sec(5),
});

const scene = project.scene("main");
scene
  .circle("dot", {
    position: { x: px(120), y: px(360) },
    radius: px(28),
    fill: "#8b5cf6",
  })
  .moveTo({ x: px(1160), y: px(360) }, { at: sec(0.5), duration: sec(3) })
  .fadeTo(opacity(0), { at: sec(4), duration: sec(1) });

export default project;
```

Motions inherit their starting value at `at`. Overlapping writers for the same property are errors.
Reactive and simulated properties fail explicitly in v0.1.

## Packages

| Package             | Responsibility                                       |
| ------------------- | ---------------------------------------------------- |
| `@eac/units`        | Branded unit values and interpolation                |
| `@eac/ir`           | Platform-neutral IR and seekable timed evaluation    |
| `@eac/core`         | User DSL and IR construction                         |
| `@eac/checker`      | Static rules, harness sampling, and AABB diagnostics |
| `@eac/renderer-svg` | SVG, PNG, and MP4 rendering                          |
| `@eac/cli`          | Self-describing agent-facing toolchain               |

SVG-specific concepts stay out of the core IR. The renderer boundary is intentionally provisional
until a second renderer exists.

## Validation

```bash
pnpm validate
```

CI checks formatting, lint, strict types, unit tests, build output, and high-severity dependency
advisories. `eac check --ci` never rewrites source.

## Bench

The benchmark compares agents given type declarations and README only; the self-describing CLI; and
the CLI plus the check-and-repair loop. Tasks and frozen metrics live in [`bench/`](bench/README.md).

## Feedback wanted

- Did your coding agent understand the CLI?
- Which APIs did it try to invent?
- Which docs searches failed?
- Which diagnostics were unclear?
- Which primitive did you expect to exist?

## Status and non-goals

v0.1 supports timed properties, four object primitives, three trajectories, 2.5D depth, approximate
AABB checks, and SVG/PNG/MP4 output. Interaction, physics, audio, particles, property composition,
Canvas/WebGPU, native UI export, image rigging, and studio editing are deliberately excluded.

## License

[MIT](LICENSE)
