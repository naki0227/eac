# Frozen v0.1 benchmark metrics

These definitions are fixed before the main five-task experiment. Pilot runs do not establish target
or expected values.

- `task_completion`: the requested experience exists and the final `eac check --ci` exits zero.
- `first_check_pass`: the first task-complete candidate exits zero from `eac check --ci`. Checks of an
  intentionally incomplete static composition are recorded as preflight checks instead.
- `repair_iterations`: candidate edits followed by another check after the first task-complete check.
- `hallucinated_api_calls`: every call to an undefined EaC function or member, including repeats.
- `invalid_api_values`: invalid names or shapes supplied to a real API. This is recorded separately
  and does not change the frozen hallucinated-call definition.
- `docs_search_count`: invocations of `eac docs search`; direct `eac docs <api>` calls are separate.
- `check_driven_repair_success`: a check diagnostic caused a later candidate to remove that finding.
- `final_errors` and `final_warnings`: all EaC diagnostics in the last check, including format errors.
- `time_to_valid_project_seconds`: wall time from session start to the first zero-exit task-complete
  check. It is `null` when the run does not converge.
- `generated_loc`: physical lines in the final generated `eac.config.mjs`.
- `cli_calls`: all invocations of the instrumented EaC CLI; `check_calls` and direct docs calls are
  also recorded for interpretation.

A saturation probe is saturated only when the agent needs almost no exploration, invents no API
surface, and completes on its first candidate without a repair. Do not increase difficulty with
ReactiveProperty or SimulatedProperty.
