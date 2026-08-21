# EaC — Experience as Code

> ⚠ Experimental
>
> EaC is currently an experimental runtime for studying how humans and coding agents can author
> deterministic, verifiable experiences as code. It is not yet a Remotion, Rive, After Effects,
> or production UI framework replacement.

**Code is the source. Experience is the output.** EaC is an experimental Experience as Code runtime
for building deterministic, seekable, and verifiable animated experiences in TypeScript.

```text
code → IR → checker → deterministic evaluation → preview / frame / video
```

Every property is a `TimedProperty`: directly evaluable at any time `t`, with exactly one writer per
property per instant. Nothing replays from frame zero, nothing reads a clock, and a scene that would
render ambiguously is a checker error rather than a surprise in the output.

The current release is [**v0.2**](docs/v0.2.md) — groups and nested transforms, deterministic motion
paths and `followPath`, `sequence`/`parallel`/`delay`/`stagger` composition, typed sRGB colors and
styles, local image assets, timed audio, and an agent-facing CLI built around a check-and-repair
loop. Its secondary research question is whether a coding agent can learn an unfamiliar creative DSL
from that CLI and converge on valid output through structured diagnostics.

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

Run the showcase, which combines groups, trajectories, composition, color, an image, and audio:

```bash
pnpm eac check --ci examples/showcase/eac.config.mjs
pnpm eac render examples/showcase/eac.config.mjs
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

Motions inherit their starting value at `at`, independent of builder call order. Overlapping writers
for the same property are errors. Reactive and simulated properties fail explicitly in v0.2.

## Examples

Every example passes `eac check --ci` and exists to demonstrate one idea.

| Example            | Demonstrates                                                     |
| ------------------ | ---------------------------------------------------------------- |
| `basic-motion`     | Timed move and fade — the smallest complete experience           |
| `cycloid-depth`    | Cycloid move trajectory and 2.5D depth ordering                  |
| `path-follow`      | `followPath` along an absolute wave trajectory                   |
| `group-transform`  | Nested groups and composed world transforms                      |
| `sequenced-motion` | `sequence`, `parallel`, and `stagger` lowered to explicit writes |
| `styled-title`     | Typed color animation, text style, stroke, and shadow            |
| `image-card`       | A frozen project-relative image asset                            |
| `audio-sting`      | A timed WAV clip with trim, volume, and fades                    |
| `showcase`         | All of the above combined at zero errors and zero warnings       |

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

A v0.1 experiment asked whether the self-describing CLI and its check-and-repair loop actually help a
coding agent. It compared agents given type declarations and README only; the self-describing CLI;
and the CLI plus the check-and-repair loop. It is supporting evidence for the tooling design, not the
identity of the project.

Tasks and frozen metrics live in [`bench/`](bench/README.md); isolation and execution are documented
in [`bench/harness/README.md`](bench/harness/README.md). The published `r3` evidence and the
`benchmark-v0.1-main-r3` tag are immutable and are not regenerated by later releases.

## Feedback wanted

- Did your coding agent understand the CLI?
- Which APIs did it try to invent?
- Which docs searches failed?
- Which diagnostics were unclear?
- Which primitive did you expect to exist?

## Documentation

| Document                                 | Contents                                       |
| ---------------------------------------- | ---------------------------------------------- |
| [`docs/v0.2.md`](docs/v0.2.md)           | v0.2 release notes, guarantees, deferred items |
| [`docs/spec/v0.2.md`](docs/spec/v0.2.md) | Implemented v0.2 semantics                     |
| [`docs/spec/v0.1.md`](docs/spec/v0.1.md) | Original design rationale                      |
| [`docs/adr/`](docs/adr/)                 | Durable architecture decisions                 |
| [`AGENTS.md`](AGENTS.md)                 | Rules for working in this repository           |

## Status and non-goals

v0.2 supports timed properties, object primitives, node groups, deterministic trajectories, motion
composition helpers, typed color and text style, local image assets, timeline audio clips, 2.5D
depth, approximate AABB checks, and SVG/PNG/MP4 output. Interaction, physics, particles, property
composition, non-WAV or analyzed audio, Canvas/WebGPU, native UI export, image rigging, and studio
editing are deliberately excluded.

## License

[MIT](LICENSE)
