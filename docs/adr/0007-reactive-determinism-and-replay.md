# ADR 0007: Reactive determinism through explicit replay

## Background

v0.1 and v0.2 are built on `value = f(time)`. Every property is directly seekable: evaluating at
time `t` reads a sorted segment list and interpolates. Nothing depends on how the runtime arrived at
`t`.

v0.3 introduces `value = f(time, signals)`. Interaction is inherently historical — whether a menu is
open at `t = 3` depends on whether a click happened at `t = 1.2`. A naive implementation would reach
for browser events and live mutable state, and would immediately lose reproducibility.

## Problem

Interactivity must not cost us the property that makes EaC worth building: the same source must
always produce the same output. Tests, screenshots, video rendering, regression harnesses, and
coding-agent repair loops all depend on it.

## Options

1. Live-only reactivity. Bind to browser events, accept that output is not reproducible offline.
2. Record output frames during a live session and treat the recording as the artifact.
3. Make the _input_ the artifact: a serializable scenario of timestamped input events, replayed
   deterministically against explicit initial state.
4. Require every reactive property to be a closed-form function of time so it stays directly
   seekable.

## Decision

Adopt option 3.

The v0.3 evaluation contract is:

```text
experience source + assets + runtime version + initial state + input scenario + t
  → deterministic evaluated experience
```

A `ScenarioIR` is plain serializable data: a duration, initial signal values, and a list of
timestamped input events with a total order. Replaying it from `t = 0` to a target time produces the
reactive state at that time. Evaluation at `t` then combines that replayed state with TimedProperties
evaluated directly at `t`.

Option 4 is rejected: it would exclude state transitions, which are the point of interaction.
Option 2 is rejected: a recording is an output, not a source, and cannot be re-rendered when the
source changes.

Forbidden in experience semantics, without exception:

- wall clock (`Date.now`, `performance.now`)
- `Math.random` or any unseeded randomness
- network access
- ambient browser or device state
- implicit pointer position, focus, or scroll read from the host
- global event listeners outside the runtime input adapter

The browser adapter converts DOM events into normalized scenario events. It is an _input source_,
never a semantic source. Anything the adapter can produce, a scenario file can also produce, and both
paths enter the same replay engine.

## Semantic honesty

We deliberately do **not** claim that ReactiveProperty is seekable in the same sense as
TimedProperty. The precise language, used everywhere in the docs:

- **TimedProperty is directly seekable.** Evaluating at `t` requires no history.
- **ReactiveProperty is deterministically replayable.** Evaluating at `t` requires replaying the
  explicit scenario from the initial state up to `t`, and always yields the same result.

Checkpoints may make replay faster. They must never make it different: an evaluation with a warm
cache and an evaluation from a cold start are required to agree, and that equivalence is tested
rather than assumed.

## Reasons

- The scenario is a small text artifact that can be committed, reviewed, diffed, and regenerated.
- One replay engine serves preview, checker, and renderer, so the three cannot drift apart.
- Recording a live interaction produces a scenario, which turns exploratory interaction into a
  reproducible fixture — the workflow that makes interactive video rendering possible at all.
- Refusing hidden inputs keeps the failure mode loud: an unsupported input has no signal to bind to,
  so it is a checker error rather than a silent environment dependency.

## Benefits

- Interactive experiences can be rendered to video, tested, and screenshotted.
- A coding agent can be handed a scenario and a diagnostic and reproduce the exact failing state.
- Replay is auditable: every state transition has a timestamp and a triggering event.

## Drawbacks

- Reactive state is not closed-form; seeking far into a long scenario costs replay work.
- Reactive results depend on the experience frame rate, because interaction is sampled at frame
  boundaries (see ADR 0009). Changing `fps` can change interaction timing.
- Authors cannot reach for arbitrary host APIs; anything not modeled as a signal is unavailable.

## Revisit conditions

Revisit if a class of reactive bindings turns out to be provably closed-form and worth seeking
directly, or if scenario length makes replay costs unacceptable even with checkpoints. Any such
change must keep cold-start and warm-cache evaluation identical.
