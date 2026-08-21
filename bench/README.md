# EaC agent-learning benchmark

The primary comparison uses one frozen task set under three conditions:

- **A:** generated `.d.ts` files and README only.
- **B:** A plus `eac help`, `guide`, `docs`, and `docs search`.
- **C:** B plus the `eac check` repair loop.

Record these metrics without adding expected values: task completion, first-check pass, repair
iterations, hallucinated API calls, docs searches, check-driven repair success, final errors, final
warnings, time to valid project, generated LOC, and CLI calls.

An undefined EaC member call counts as a hallucinated API call every time it appears. Freeze task
wording before the first main run. First run one task in a fresh agent session. If it completes with
almost no exploration, no invented API, and a first-pass result, judge the benchmark saturated before
running the full suite. Increase difficulty only with timed APIs; do not add reactive behavior.

Use [`tasks.json`](tasks.json) as the frozen v0.1 task source. Store run records as JSON under
`results/` with condition, agent/model, CLI version, commit SHA, timestamps, every metric, and notes.
