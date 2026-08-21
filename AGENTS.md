# Working on EaC

EaC is an experimental Experience as Code runtime.

## Before making changes

1. Read this file, `docs/spec/v0.2.md`, and `docs/spec/v0.1.md` for the original rationale.
2. Read `docs/TODO.md` and the latest report in `docs/reports/`.
3. Run the test suite.
4. Keep v0.2 scope intentionally small.

## Core rules

- EaC is not an AI agent.
- v0.2 supports `TimedProperty` only. Reactive and simulated properties fail explicitly.
- A property may have only one writer at any time.
- Do not introduce property composition in v0.2.
- Do not leak SVG-specific details into the core IR.
- Renderer abstraction is provisional until a second renderer exists.
- Only the CLI touches the filesystem. Assets and audio resolve once into frozen embedded records.
- Relative motion resolves from the property value at its own start time, never from call order.
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

Run `pnpm validate`, `pnpm audit --audit-level high`, and `pnpm eac check --ci` on the examples.
`bench/results/r3`, `docs/benchmark-r3.md`, and the `benchmark-v0.1-*` tags are immutable evidence.
