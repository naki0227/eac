# ADR 0002: Docker-isolated benchmark harness

## Status

Accepted; the first main freeze was protocol-invalid and revision 2 is pending.

## Context

Worktrees and fresh conversations do not prevent a coding agent from reading sibling workspaces,
implementation source, prior results, or disallowed checker output. Conditions A/B/C require hard
information boundaries for meaningful comparisons.

## Decision

Run every coding-agent session in a fresh Docker container with only condition-specific materials and
its own workspace mounted. Keep documentation/check execution in a separate capability service that
enforces command policy. Perform final validation in a detached, networkless evaluator. Stage all
results under ignored host-only storage until the experiment finishes.

Metrics that require semantic interpretation use an immutable two-stage record: raw result and
evidence first, then a hash-bound human audit that produces a separate audited result. The raw record
is never rewritten. A real-auth transport preflight with no EaC materials is required for the frozen
commit before benchmark execution.

Allowed README and public declarations remain mounted rather than inlined. A common harness prompt
identifies their paths so agents can actually discover them without changing the frozen task wording.
A separate real-agent material-discovery preflight must prove README and declaration reads for the
exact commit/model/reasoning tuple before any benchmark run.

Real agents use an internal Docker network and a CONNECT proxy restricted to the required OpenAI
service hosts. The agent runner prefers a narrowly mounted, file-based ChatGPT authentication cache;
the entrypoint copies that cache into per-run tmpfs and never mounts the rest of the host Codex
configuration. API-key authentication remains an optional fallback. The agent image is pinned to an
explicit Codex CLI version, while all images carry the frozen repository revision as an OCI label.

## Alternatives considered

- Worktrees and prompt-only restrictions: rejected because filesystem and command isolation are not
  enforceable.
- Copying compiled EaC packages into children: rejected because agents could inspect hidden runtime
  implementation and bypass CLI policy.
- Kubernetes or a remote scheduler: rejected as unnecessary for fifteen local sequential runs.
- Requiring an API key: rejected because local Codex supports ChatGPT subscription authentication,
  and the benchmark does not inherently require usage-based API access.

## Benefits

- Enforces filesystem, command, evaluator-output, and cross-run boundaries.
- Keeps condition policy small and auditable.
- Supports deterministic preparation, order, resumption, and raw result retention.
- Makes manual metric judgments attributable and detects stale audits through raw-byte hashes.
- Avoids host repository/config-directory mounts and committed secrets.

## Costs and risks

- Docker builds and sidecars add runtime and maintenance cost.
- OpenAI service endpoint changes require proxy allow-list updates and a new freeze.
- File-based ChatGPT auth contains bearer credentials and must be handled like a password; Docker
  host administrators remain able to inspect it while a run exists.
- A malicious Docker host administrator remains outside the threat model.
- Some transcript-derived metrics still require human audit.
- The real-auth preflight consumes one minimal Codex turn outside the benchmark task set.
- The material-discovery preflight consumes a second non-benchmark Codex turn before each freeze.

## Revisit when

- Codex authentication cannot operate through the strict allow-list;
- benchmark execution moves to a managed sandbox with equivalent hard boundaries;
- another agent runner requires a different authenticated endpoint;
- the benchmark expands beyond the local fifteen-run v0.1 experiment.
