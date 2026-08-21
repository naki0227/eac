# ADR 0012: A data scenario format and checkpointed replay

## Background

ADR 0007 makes the input trace the artifact. That trace needs a concrete format and a replay
algorithm whose cost does not make seeking unusable.

## Problem

The format has to be reviewable, diffable, safe to accept from a stranger, and stable enough for
`order` ties to be impossible. Replay has to reach an arbitrary time without re-deriving everything
from zero on every seek, while producing the same answer as if it had.

## Options

**Format**

1. TypeScript callbacks only.
2. JSON only.
3. A TypeScript builder that emits one canonical JSON-serializable IR, with both accepted as input.

**Replay**

1. Always replay from `t = 0`.
2. Keep a mutable live session and mutate it forward and backward.
3. Replay from the nearest checkpoint, taking periodic snapshots.
4. Derive a closed-form state function.

## Decision

Adopt format option 3 and replay option 3.

`ScenarioIR` carries `version`, `scenarioVersion`, name, duration, optional initial pointer and
scroll, an event list, and assertions. Every event has `at`, a strictly increasing global `order`,
and a payload. Because `order` is assigned by the builder as a global sequence, two events can never
tie, and replay order is fixed by construction rather than by sort stability. `.json` files are
parsed as data — never imported, never `eval`ed — and a `.mjs` builder is accepted for authoring
because it produces the same IR.

Replay walks the step sequence of ADR 0009. `ExperienceSession` snapshots the full replay state
every 64 steps and resumes from the nearest snapshot at or before the target. The snapshot holds
pointer, scroll, keys, state values, hover and pressed targets, and triggered sounds — everything a
step reads — so resuming is indistinguishable from replaying.

Option 2 for replay is rejected: reversible mutation is where "seek backward gives a different
answer" bugs live. Option 4 is rejected because state transitions are not closed-form.

## Reasons

- A caching layer that can change an answer is worse than no caching, so `replayFresh` exists
  alongside `replayTo` and a test asserts they agree at every probed time.
- Assigning `order` at build time removes an entire class of ordering bugs instead of documenting a
  tie-break for them.
- Refusing to execute scenario files keeps a recorded trace safe to commit, review, and share.
- Accepting both a builder and JSON costs one parser and makes recorded traces and authored traces
  the same kind of thing.

## Benefits

- Recorded and authored scenarios are interchangeable inputs to check, inspect, preview, and render.
- Seeking around a long trace stays responsive without a second code path.
- Scenario files diff readably in review.

## Drawbacks

- Replay is still linear in events between checkpoints; a very long trace with a distant seek costs
  real work.
- Checkpoints hold whole state snapshots, so memory grows with the number of distinct seeks.
- The 64-step interval is a guess, not a measured optimum.
- A hand-edited JSON scenario can violate ordering; the checker reports it rather than repairing it.

## Revisit conditions

Revisit if trace lengths make linear replay between checkpoints noticeable, or if scenarios need to
compose. Any change must preserve the invariant that a cached evaluation and a cold one agree.
