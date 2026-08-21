export const help = `EaC — Experience as Code

EaC is a deterministic creative runtime.

If this is your first time using EaC:

1. Run \`eac guide\`
2. Inspect the project with \`eac inspect\`
3. Build one scene at a time
4. Start with static geometry
5. Add timed motion
6. Run \`eac check\`
7. Fix all errors
8. Preview
9. Render

Do not attempt to invent EaC APIs.

If you are unsure which API to use:
  eac docs search "<what you want to do>"

For an API:
  eac docs <api>

To format a project after a check diagnostic:
  eac format <project>`;

export const guide = `HOW TO BUILD WITH EAC

Phase 1 — Understand
- Read the task
- Determine canvas size
- Determine duration

Phase 2 — Structure
- Create scenes
- Identify objects

Phase 3 — Static Composition
- Place Rect / Circle / Text / Path
- Run eac check

Phase 4 — Motion
- Add one motion group at a time
- Prefer existing primitives
- Never invent API names
- Use eac docs search when uncertain

Phase 5 — Validate
- Run eac check
- Read the full diagnostic
- Fix the cause, not only the symptom

Phase 6 — Preview
- Preview before rendering

Phase 7 — Render
- Render only after eac check passes

Do not generate the entire experience in one pass.`;
