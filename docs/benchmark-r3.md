# EaC v0.1 Agent Learning Benchmark — r3 report

## Research question

Can a coding agent learn an unfamiliar creative DSL from its allowed materials, use a
self-describing CLI to navigate the API, and use executable diagnostics to converge on a valid
experience?

The result supports a narrower formulation:

> Self-describing documentation helps agents navigate an unfamiliar DSL; structured executable
> diagnostics help them converge on valid experiences.

## Method

The experiment ran five frozen tasks once under each condition:

- A: README and public `.d.ts` declarations.
- B: A plus `eac help`, `guide`, and `docs` discovery capabilities.
- C: B plus `eac check --ci` and the repair loop.

Every run received a fresh isolated Docker workspace, network, agent container, and—only for B/C—a
capability service. Egress passed through the same allow-listed proxy policy. The evaluator ran
outside the agent's capability boundary. Materials were identified by path, not embedded into the
task prompt.

The frozen commit was `e4e69417f701e0944f1ae4aa8db1017efb9828c0`, tagged
`benchmark-v0.1-main-r3`. All runs used Codex CLI `0.149.0`, model `gpt-5.6-sol`, and `medium`
reasoning. Pre-freeze gates included CI, 21 Docker smoke checks, ChatGPT-auth transport, and a real
agent material-discovery integration test.

## Audited results

| Condition | Completion | Errors | Warnings | Docs searches | Direct docs | Check calls |
| --------- | ---------: | -----: | -------: | ------------: | ----------: | ----------: |
| A         |        4/5 |      1 |        5 |             0 |           0 |           0 |
| B         |        4/5 |      1 |        4 |             5 |          12 |           5 |
| C         |    **5/5** |  **0** |    **1** |             5 |          10 |           7 |

Across all 15 runs, the human audit recorded zero undefined EaC API calls and zero agent-authored
invalid API values. It recorded one repair iteration and two successful check-driven repairs.

### A→B: discoverability

The agent used the CLI documentation—five searches and twelve direct topic calls—but completion
remained 4/5 and final errors remained one. Warnings fell from five to four. This shows the
documentation was discoverable and used; this sample does not show a completion-rate improvement
from documentation alone.

### B→C: correctness convergence

Completion improved from 4/5 to 5/5, final errors fell from one to zero, and warnings fell from four
to one. In `broken-experience-repair`, a preflight check diagnosed the supplied fixture and directly
caused the first passing task-complete candidate. In `multi-stage-motion`, the first task-complete
candidate failed the format gate; one edit and re-check removed the finding.

The first case correctly has `repair_iterations = 0` and `check_driven_repair_success = true`: the
frozen repair metric starts only after the first task-complete candidate, while check-driven success
can originate from an incomplete preflight check.

## Human audit and evidence disclosure

Raw result records left hallucinated calls, invalid values, repair iterations, and check-driven
repair success unset. A reviewer examined each transcript, CLI event stream, undefined-API candidate
list, final source, and evaluator result. Each public audit names the reviewer, records the time and
judgment notes, and binds to the exact private raw-result bytes by SHA-256. Applying an audit created
a separate result and did not mutate the raw record.

Public evidence includes the audited records, audits, run order, manifest, and byte-identical final
sources. Raw transcripts and operational logs remain private pending a dedicated redaction review.

## Invalidated and interrupted batches

- r1 was invalidated because the agent prompt did not disclose where allowed materials were mounted.
- r2 fixed material discovery but was invalidated because the result parser omitted format-required
  diagnostics from `final_errors`.
- The first r3 attempt was discarded after the desktop/OrbStack execution environment was closed.
  Its partial results were not resumed or mixed into the accepted batch.

The failed batches remain documented rather than being silently removed; only the fresh 15-run r3
batch is reported as the main result.

## Limitations

- Five tasks per condition are insufficient for statistical generalization.
- One model, reasoning setting, CLI version, API size, and task family were tested.
- A/B time-to-valid includes evaluator time after agent termination.
- B's unavailable checker makes first-check comparisons asymmetric.
- Zero observed hallucinated calls does not establish a general no-hallucination property.
- Raw transcripts are not currently public, so third parties can verify published hashes and final
  artifacts but cannot yet independently repeat the manual transcript judgments.
