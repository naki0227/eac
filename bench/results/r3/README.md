# EaC v0.1 Agent Learning Benchmark — r3

Fifteen isolated runs tested whether a coding agent could learn EaC's unfamiliar DSL from static
materials, navigate it through self-describing CLI documentation, and converge through structured
checker diagnostics.

| Condition | Capability                            | Completion | Errors | Warnings |
| --------- | ------------------------------------- | ---------: | -----: | -------: |
| A         | README + public type declarations     |        4/5 |      1 |        5 |
| B         | A + self-describing CLI documentation |        4/5 |      1 |        4 |
| C         | B + executable check/repair loop      |    **5/5** |  **0** |    **1** |

The CLI documentation was used in B and C, but A→B did not improve completion in this five-task
sample. B→C improved completion from four to five tasks and reduced final errors from one to zero.
Checker diagnostics directly drove a successful later candidate in two C runs.

No undefined EaC API call was observed in any of the 15 runs. This is limited to these tasks, this
public API surface, and `gpt-5.6-sol` with `medium` reasoning; it is not a general claim that EaC or
the model cannot hallucinate.

## Frozen configuration

- Tag: `benchmark-v0.1-main-r3`
- Commit: `e4e69417f701e0944f1ae4aa8db1017efb9828c0`
- Agent: Codex CLI `0.149.0`
- Model/reasoning: `gpt-5.6-sol` / `medium`
- Design: five tasks × conditions A/B/C
- Order: deterministic seed recorded in `manifest.json`; one isolated network/container/workspace per run
- Audit: four transcript-derived metrics were manually reviewed and bound to immutable raw-result hashes

## Published evidence

- `summary.json`: audited aggregate
- `audited-results/`: all 15 final result records
- `audits/`: hash-bound human audit records
- `artifacts/`: byte-identical final `eac.config.mjs` files
- `run-order.json`: seeded execution order
- `manifest.json`: freeze metadata and SHA-256 bindings

Raw Codex transcripts, stdout/stderr, proxy logs, auth material, and `.bench-private` are not
published. The audit records expose each private raw result's SHA-256, allowing later disclosure or
independent verification without silently replacing the underlying evidence.

## Interpretation limits

- `n=5` per condition supports descriptive comparison, not statistical generalization.
- A/B time-to-valid includes evaluator time after the agent stopped.
- B cannot execute `eac check`, so its first-check field does not share C's observation path.
- A and B both failed `multi-stage-motion` because the final source did not satisfy the formatting gate.
- Invalidated r1/r2 batches and the interrupted r3 attempt are documented under `bench/history/`.

See [`docs/benchmark-r3.md`](../../../docs/benchmark-r3.md) for methodology and task-level analysis.
