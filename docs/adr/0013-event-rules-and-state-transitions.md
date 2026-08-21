# ADR 0013: Event rules as data, not callbacks

## Background

Interaction needs more than derived values. Clicking a button has to _change_ something, and that
change has to survive into the next step.

## Problem

The obvious API is a callback: `button.onClick(() => setOpen(!open))`. A callback is opaque. It
cannot be serialized, inspected, checked for conflicting writes, or explained in a diagnostic, and it
invites arbitrary side effects — exactly what ADR 0007 forbids.

## Options

1. Store JavaScript callbacks and run them during replay.
2. Allow imperative mutation of a state object.
3. Lower interactions into declarative rules: trigger, optional guard, and a small closed set of
   actions.
4. Ship a full state-chart formalism with nested states and transitions.

## Decision

Adopt option 3.

An `EventRuleIR` is `{ id, trigger, guard?, actions[] }`. Triggers are `pointerEnter`,
`pointerLeave`, `pointerDown`, `pointerUp`, and `click` on a named node; `keyDown` and `keyUp` on a
named code; and `scroll`. Guards are ordinary expressions from the ADR 0008 vocabulary. Actions are
deliberately three:

- `setState(name, expression)`
- `toggleState(name)`
- `playSound(id)`

`playSound` is the one action with an effect outside state. It is modeled as data: replay records
`{ sound, at }` at the triggering step, and the encoder turns those records into ordinary audio
clips. There is no WebAudio, no streaming, and no scheduling API.

Rules matching one semantic event run in declaration order, and all guards read the state as it
stood at the start of the step, so rules inside a step cannot observe each other's writes. Two writes
to one state in one step are an error rather than a race (ADR 0011).

Option 4 is rejected for now: a state chart is a bigger formalism than "toggle a panel" needs, and
adopting one early would fix vocabulary we have not yet earned.

## Reasons

- Rules as data are the only form the checker can validate and `inspect` can print as
  `click(button) -> toggle(expanded)`.
- Three actions cover the interactions v0.3 claims to support, and each new action costs a checker
  rule and a printer case, so the cost is visible.
- Modeling sound as a recorded timestamp keeps reactive audio exactly as replayable as the video.
- Reading pre-step state makes rule order irrelevant to the result, which removes a whole class of
  order-dependent bugs.

## Benefits

- A coding agent can be shown every rule, its trigger, its guard, and its effects.
- The transition history is enumerable, so `inspect` prints `t=1.200 click(button) open false → true`.
- Colliding writes are caught statically when two rules share a trigger.

## Drawbacks

- No numeric increment action; `setState(count, add(count.value, 1))` is the spelling.
- No way to run a timed animation _in response to_ an event; that is the timed/reactive boundary of
  ADR 0011 and remains a real limitation.
- Rules cannot read the event payload, so "click at x, y" is not expressible.
- No nested or hierarchical states.

## Revisit conditions

Revisit when an interaction cannot be expressed by trigger, guard, and these actions — most likely
when a design needs an event to start a timed animation. That is the feature that would justify
revisiting ADR 0011 as well.
