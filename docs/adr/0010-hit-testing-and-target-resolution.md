# ADR 0010: Hit-testing in node-local space with a single topmost target

## Background

Hover and click need to answer "which node is under this point". The renderer already knows, because
the browser can hit-test the SVG it produced. Reaching for that answer would tie interaction
semantics to one renderer and one host.

## Problem

Target resolution must be platform-neutral, exact under rotation and scale, defined for nested
groups, and stable enough that a diagnostic can explain why a particular node was chosen.

## Options

1. Ask the DOM which element is under the pointer.
2. Test the pointer against each node's axis-aligned world bounding box.
3. Transform the pointer into each node's local space with the inverse world matrix, then test it
   against the node's own geometry.

## Decision

Adopt option 3.

Each candidate's world matrix is inverted and the pointer is mapped into node-local coordinates, so
a rotated bar is tested as a bar rather than as the larger box that contains it. Local tests are
exact for rect, circle, and image; text uses the same deterministic advance-width box the AABB
harness already uses; path uses the local bounding box of its points, which is documented as
approximate.

Resolution rules:

- **Frontmost wins**: highest world depth, then latest declaration order, then node id. This is the
  exact reverse of the renderer's paint order, so the target is always the visually frontmost node.
- **Leaves only**: groups are not targets. A group participates by transforming its children.
- **Invisible nodes are not hittable**: world opacity of zero means no target.
- **Opt out**: `interactive: false` removes a node from hit-testing, so a full-bleed backdrop does
  not swallow every interaction.
- **No bubbling, no capture**: exactly one target per point. v0.3 does not clone DOM propagation.

## Reasons

- Inverse-transform testing is a few lines and is correct under every transform the IR can express,
  where an AABB is wrong as soon as a node rotates.
- Reusing the renderer's ordering rule for "frontmost" means the thing you can see is the thing you
  can click, by construction rather than by coincidence.
- A single target keeps rules unambiguous and diagnostics short; a propagation model would have to
  define ordering, cancellation, and re-entrancy before it bought anything.
- `interactive: false` is the smallest escape hatch that prevents the most common authoring trap.

## Benefits

- Hit-testing runs identically in the checker, the preview, and the renderer.
- Rotated and scaled interactive nodes work without special cases.
- "Why this node?" is answerable from depth, declaration order, and id alone.

## Drawbacks

- Path hit areas are rectangles, so a thin diagonal path is over-eager near its bounding box.
- Text hit areas inherit the advance-width approximation and do not match real glyph metrics.
- Without bubbling, a parent cannot observe interaction with its children.
- Nodes hidden behind an opaque neighbour are still hittable if they are frontmost by depth; z order
  decides, not visual occlusion.

## Revisit conditions

Revisit when a real design needs parent-level interaction, per-glyph text targeting, or true path
outline hit-testing. Any change must keep target resolution renderer-independent.
