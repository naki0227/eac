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
The exact metric definitions are frozen in [`metrics.md`](metrics.md).
The main experiment must use the Docker isolation workflow in [`harness/README.md`](harness/README.md).

## v0.1 saturation probe

The authoritative Condition C Task 1 probe completed in 65 seconds with no undefined API calls. Its
first candidate passed with one approximate AABB warning; the agent used one repair to reach zero
errors and zero warnings. It also used one docs search and seven direct API-documentation calls.

This is **not saturated** under the predeclared rule because the run required broad documentation
exploration and a warning-driven repair. Do not expand the timed API before the main five-task
experiment. The preceding pilot and protocol-validation records are retained because they exposed the
missing self-contained formatter and an unstructured invalid-trajectory failure.
