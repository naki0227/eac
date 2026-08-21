# ADR 0011: One property, one writer category

## Background

v0.1 and v0.2 enforce a strict single-writer rule: one logical writer owns one property over one
interval, and overlaps are errors. v0.3 adds a second kind of writer — a reactive binding — that
produces a value at every instant rather than over an interval.

## Problem

If a property has both a `fadeTo` and an opacity binding, what is its value? Any answer we pick is a
silent precedence rule that authors will have to memorize, and that a diagnostic cannot explain
without describing an ordering that exists nowhere in the source.

## Options

1. Reactive overrides timed whenever it is present.
2. Timed overrides reactive.
3. Multiply or add the two results.
4. Refuse the combination: a property is timed-driven or reactive-driven, never both.
5. Add an explicit composition primitive that names the combination.

## Decision

Adopt option 4 for v0.3.

A property may have timed segments or exactly one reactive binding. Both is
`eac::reactive::mixed-property-writers`. Two reactive bindings on one property is the same error.
The granularity is the whole property, matching how `followPath` already claims the vector position
property as one writer.

State writes follow the same principle: two writes to one state inside one step are
`eac::reactive::multiple-state-writers`, reported statically when two rules share a trigger and at
replay time when they actually collide. There is no last-writer-wins.

Option 5 is the honest long-term answer and is deferred rather than rejected — but a composition
primitive has to name _how_ two sources combine, and inventing that syntax while the reactive model
is one release old would freeze a guess.

## Reasons

- One cause per value is the property that makes `inspect` and diagnostics readable at all.
- Refusing is reversible; a precedence rule is not, because sources will come to depend on it.
- The error arrives at check time with both writers named, which is a better authoring experience
  than a value that is quietly half-animated.
- Keeping the granularity at the property level means the v0.2 conflict machinery extends rather
  than forks.

## Benefits

- A property's value always has exactly one explanation.
- Timed and reactive can still coexist freely on different properties of the same node, which is
  what the showcase does.
- No hidden precedence for a future composition primitive to contradict.

## Drawbacks

- A common desire — animate in with a timed fade, then let hover take over opacity — needs two nodes
  or a different property.
- Authors converting a v0.2 scene to reactive must remove the timed writer rather than layer on top.
- The rule is stricter than most UI frameworks, which will surprise people.

## Revisit conditions

Revisit when an explicit composition primitive is designed, with a named combination rule and a
diagnostic that can print it. Until then, do not relax the refusal into a precedence.
