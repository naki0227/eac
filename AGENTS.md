# Working on EaC

EaC is an experimental Experience as Code runtime.

## Before making changes

1. Read this file and `docs/spec/v0.1.md`.
2. Read `docs/TODO.md` and the latest report in `docs/reports/`.
3. Run the test suite.
4. Keep v0.1 scope intentionally small.

## Core rules

- EaC is not an AI agent.
- v0.1 supports `TimedProperty` only. Reactive and simulated properties fail explicitly.
- A property may have only one writer at any time.
- Do not introduce property composition in v0.1.
- Do not leak SVG-specific details into the core IR.
- Renderer abstraction is provisional until a second renderer exists.
- Diagnostics use namespaced string identifiers and explain what, where, why, and how.
- Rendering must be deterministic.

## Architecture

- `units`: value and unit types
- `ir`: platform-neutral data and time evaluation
- `core`: user DSL and IR builder
- `checker`: validation and harness
- `renderer-svg`: deterministic SVG/PNG/MP4 rendering
- `cli`: command interface

Keep files focused and below 300 lines unless a test matrix or generated data justifies otherwise.

## Before finishing

Run `pnpm validate` and `pnpm --filter @eac/cli eac check --ci examples/basic-motion/eac.config.mjs`.
