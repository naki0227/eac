# ADR 0008: A closed signal registry and an explicit expression IR

## Background

Reactive bindings need to say things like "scale is 1.05 while the pointer is over this card, else 1"
and "header opacity is `clamp(1 - scroll.y / 300)`". The authoring language for that is naturally a
TypeScript function. The runtime representation must not be.

## Problem

If a binding stores an opaque JavaScript closure, the IR stops being data. It cannot be serialized,
diffed, inspected, type-checked by the checker, cycle-checked, explained in a diagnostic, or replayed
by any runtime other than the one that created it. A coding agent cannot be told _why_ a value came
out wrong.

## Options

**Signals**

1. Expose raw DOM events and let bindings read whatever they want.
2. A string-keyed bag of arbitrary named signals.
3. A closed, typed registry of signal references with a small fixed vocabulary.

**Expressions**

1. Store JavaScript closures produced by the authoring DSL.
2. Store source text and evaluate it with `eval` / `new Function`.
3. Lower authoring expressions into an explicit, typed expression IR with a deliberately small node
   vocabulary.
4. Embed a general-purpose scripting language.

## Decision

Adopt signal option 3 and expression option 3.

### Signals

A `SignalRef` is a small tagged union, all values typed as `number` or `boolean`:

```text
pointer.x | pointer.y            number
pointer.down | pointer.present   boolean
scroll.x | scroll.y              number
viewport.width | viewport.height number
key(<code>)                      boolean
hover(<node>)                    boolean
pressed(<node>)                  boolean
state(<name>)                    number | boolean
```

`hover` and `pressed` are derived by the hit-test phase (ADR 0009, ADR 0010) rather than read from
the host, so "is the pointer over this card" has a geometric definition instead of a browser one.
Raw DOM events never appear in the IR; the browser adapter normalizes them into scenario events which
update these signals.

Restricting values to `number` and `boolean` is what makes static typing of the expression IR cheap
and total.

### Expressions

The authoring DSL accepts TypeScript, but every helper it offers is a constructor that returns an IR
node. `when(hover(card), 1.05, 1)` builds a `conditional` node; it does not capture a closure. The
vocabulary is closed:

```text
const  signal
add sub mul div min max neg
eq neq lt lte gt gte
and or not
conditional  clamp  lerp
```

That is enough for interaction and small enough to type-check, cycle-check, print, and serialize. It
is emphatically not a programming language: no loops, no user functions, no recursion, no state
mutation from inside an expression. Anything requiring more belongs in an event rule, or outside EaC.

`eval` and `new Function` are forbidden anywhere in the runtime. Scenario files and reactive IR are
data; loading one must never execute code from it.

## Reasons

- Data IR is the only form the checker can validate, `inspect` can print, and a second runtime could
  ever consume.
- A closed signal vocabulary means an unknown signal is a clean `eac::reactive::undefined-signal`
  diagnostic instead of `undefined` propagating into geometry.
- Two value types keep type inference over the expression tree a short, total function.
- Constructor helpers give authors ordinary TypeScript ergonomics and autocomplete while producing
  inert data, so the authoring convenience costs nothing at runtime.
- Refusing `eval` keeps a scenario file safe to accept from a colleague or an agent.

## Benefits

- Bindings can be printed back to the author as readable expressions in diagnostics and `inspect`.
- Cycles across bindings, state, and signals are detectable statically over a finite graph.
- Reactive IR serializes alongside the rest of the experience.

## Drawbacks

- Authors cannot express computations outside the vocabulary; some will want string handling, easing
  curves over signals, or arithmetic we did not include.
- Every new capability costs an IR node, a type rule, an evaluator case, and a printer case.
- The DSL looks slightly heavier than plain arrow functions at the call site.

## Revisit conditions

Revisit when a concrete, repeated authoring need cannot be expressed — the likely first candidates
are colour-space aware mixing and easing applied to a signal rather than to time. Grow the vocabulary
one node at a time with a type rule and a printer; do not introduce closures or an interpreter.
