# ADR 0006: Typed sRGB color and an explicit IR version gate

## Background

v0.1 carried colors as untyped strings straight through to the SVG renderer and had no serialized-IR
version policy, because there was only one IR shape and colors were never animated. v0.2 animates
fill and stroke, adds a node tree, and changes the IR shape enough that an old serialized document
would be silently misread.

## Problem

Two related boundaries need a durable decision:

1. What exactly does it mean to interpolate between two colors, and where does that meaning live?
2. What happens when a document written for an older IR is handed to a newer runtime?

Both are places where a system can quietly produce plausible-looking but wrong output.

## Options

**Color**

1. Keep strings and let the renderer decide; interpolate by parsing at render time.
2. Normalize to typed RGBA at the authoring boundary and interpolate per channel in sRGB.
3. Normalize to typed RGBA and interpolate in a perceptual space (Oklab/CIELAB).

**Compatibility**

1. Accept any serialized IR and best-effort reinterpret it under v0.2 semantics.
2. Accept any serialized IR but warn.
3. Require an explicit version and refuse anything else with a diagnostic that names the version.
4. Ship migration tooling that rewrites v0.1 documents into v0.2.

## Decision

Adopt color option 2 and compatibility option 3.

`hex`, `rgb`, `rgba`, and `normalizeColor` convert at the authoring boundary into a frozen `ColorIR`
with finite channels from 0 through 1. Interpolation is a straight per-channel lerp in non-linear
sRGB, alpha included, with no premultiplication. The renderer only serializes an already-decided
value; it never parses or reinterprets color.

`ExperienceIR` carries `version: "0.2"` and `irVersion: 2`, validated in one place in the project
loader. A document whose version is `"0.1"` is refused with a diagnostic that names v0.1 and tells
the author to rebuild from a v0.2 TypeScript source. Any other version is refused with the version it
actually found. No migration tooling ships in v0.2.

## Reasons

- Converting once at the boundary means every consumer sees the same value, and a bad color is a
  checker error rather than a renderer surprise.
- sRGB channel lerp is a few lines that a reviewer can verify by hand and that reproduces bit-for-bit
  across machines; a perceptual space adds a conversion pair whose rounding we would then have to
  pin.
- Refusing an unknown version is the only option that cannot silently produce wrong output, and the
  named diagnostic tells the author what to do instead of what went wrong.
- TypeScript sources are the intended durable format, so migration tooling would serve a format we do
  not encourage authoring by hand.

## Benefits

- Color is deterministic, testable, and identical across renderers.
- Invalid channels are caught before rendering, with repair guidance.
- Old documents fail loudly and cheaply instead of producing subtly wrong scenes.
- Version validation has one home, so a future `irVersion: 3` extends one function.

## Drawbacks

- sRGB channel interpolation is not perceptually uniform; fades through saturated complementary
  colors can pass through a muddy midpoint.
- Authors holding serialized v0.1 IR have no automated path forward and must rebuild from source.
- Storing color as four numbers loses the author's original notation in the IR.

## Revisit conditions

Revisit color when a second renderer or an explicit gradient/blend feature makes perceptual
interpolation worth the conversion cost, and revisit compatibility when serialized IR becomes a
supported interchange format that third parties author directly. Neither may silently change existing
v0.2 output.
