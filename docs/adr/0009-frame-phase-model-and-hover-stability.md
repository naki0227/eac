# ADR 0009: Frame phase model and hover stability

## Background

This is the hardest semantic problem in v0.3.

Hover depends on geometry. Geometry can depend on hover. A card that grows when hovered, or shrinks
when hovered, closes a loop: the pointer is inside, so the card scales, so the pointer is outside, so
the card scales back, so the pointer is inside. Evaluated naively at a single instant this either
oscillates forever or resolves by accident of evaluation order.

Separately, hover can change without any input at all: a TimedProperty can slide a moving card under
a stationary pointer.

## Problem

We need one phase model that is deterministic, terminates, matches between live preview and offline
render, handles geometry that moves on its own, and never silently introduces a circular definition.

## Options

1. Evaluate hit-testing against the scene produced by the current frame's reactive output
   (fixed-point). Requires iteration and may not converge.
2. Forbid reactive bindings on any property that affects hit geometry. Rules out the central
   hover-scale interaction.
3. Re-evaluate hover only when an input event arrives. Simple, but a moving object never acquires
   hover under a stationary pointer.
4. Advance interaction in discrete steps. At each step, hit-test against the scene as it stood
   _before_ that step's transitions, then apply transitions and recompute reactive output.

## Decision

Adopt option 4, with steps drawn from the merge of frame ticks and scenario events.

### Step sequence

The replay timeline is the ordered merge of:

- **frame ticks** at `k / fps` for every `k` from 0 through `floor(duration × fps)`
- **scenario events**, each carrying an author-assigned global `order`

Steps sort by `(time, rank, order)` where a tick has `rank = 0` and an event has `rank = 1`. At the
same timestamp the tick therefore runs first — the scene moves, then the input arrives. Ties are
impossible because `order` is a strictly increasing global sequence.

### Phases within one step

1. **Freeze interaction geometry.** Build the interaction scene from TimedProperties at the step's
   time and the reactive bindings evaluated with the state committed by the _previous_ step.
2. **Apply raw input.** A scenario event updates raw signals: pointer position, pointer button,
   pressed keys, scroll offsets. A tick changes no raw signal.
3. **Hit-test.** Resolve the topmost target under the current pointer position against the geometry
   frozen in phase 1.
4. **Derive semantic events** by comparing the previous target and button state with the new ones:
   `pointerLeave`, `pointerEnter`, `pointerDown`, `pointerUp`, `click`, `keyDown`, `keyUp`, `scroll`,
   in that fixed order.
5. **Evaluate rules.** For each semantic event in order, matching rules run in declaration order.
   Guards are evaluated against the state as it stood at the start of the step, so rules in one step
   cannot see each other's writes.
6. **Commit state atomically.** Two writes to the same state name within one step are an error, not a
   last-writer-wins race.
7. **Recompute reactive output** from the committed state and signals.

Evaluating at a time that is not a step boundary replays every step up to that time, then evaluates
TimedProperties at the exact requested time. Timed motion stays continuous; reactive state is a step
function of step boundaries.

### Why this is stable

Phase 1 freezes geometry before phase 3 reads it, so hover in step _n_ can never depend on hover in
step _n_. The hover-scale loop resolves into a one-step lag: the pointer enters, the card grows on
the next output, and if growing moves the card out from under the pointer the change is observed at
the following step. The result is a well-defined two-step alternation with a documented cause, not an
unbounded oscillation, and it is identical in preview and in rendered video.

Because ticks are steps, a card animated by a TimedProperty under a stationary pointer acquires hover
at the next frame boundary, which is exactly when a viewer would see it move.

## Reasons

- One rule — "hit-test the previous stable scene" — removes every same-instant feedback loop without
  banning any binding.
- Frame ticks are already part of the experience (`fps` lives in the IR), so sampling interaction at
  frame boundaries introduces no new concept and guarantees preview and render agree.
- Discrete steps make the whole interaction history enumerable, which is what `inspect` and scenario
  assertions report against.

## Benefits

- Termination is structural; there is no fixed-point iteration to diverge.
- Hover, click, and state transitions have exact timestamps that a diagnostic can name.
- Live and offline evaluation run the identical step loop.

## Drawbacks

- Reactive output lags input by one step. At 30fps that is 33ms, invisible in practice but real.
- Interaction timing is quantized to `fps`, so changing the frame rate can shift a transition by up
  to one frame.
- A pathological binding can still alternate between two states on successive frames. That is
  visible, deterministic, and the author's responsibility; the checker does not attempt to prove
  visual stability.

## Revisit conditions

Revisit if a demonstrated interaction genuinely needs sub-frame input resolution, or if a restricted
class of bindings can be proven not to affect hit geometry and could therefore be resolved within a
single step. Any change must keep preview and render in exact agreement.
