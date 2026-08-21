# ADR 0002: Docker-isolated benchmark harness

## Status

Accepted for implementation; main benchmark freeze pending.

## Context

Worktrees and fresh conversations do not prevent a coding agent from reading sibling workspaces,
implementation source, prior results, or disallowed checker output. Conditions A/B/C require hard
information boundaries for meaningful comparisons.

## Decision

Run every coding-agent session in a fresh Docker container with only condition-specific materials and
its own workspace mounted. Keep documentation/check execution in a separate capability service that
enforces command policy. Perform final validation in a detached, networkless evaluator. Stage all
results under ignored host-only storage until the experiment finishes.

Real agents use an internal Docker network and a CONNECT proxy restricted to the Codex API host. The
agent image is pinned to an explicit Codex CLI version, while all images carry the frozen repository
revision as an OCI label.

## Alternatives considered

- Worktrees and prompt-only restrictions: rejected because filesystem and command isolation are not
  enforceable.
- Copying compiled EaC packages into children: rejected because agents could inspect hidden runtime
  implementation and bypass CLI policy.
- Kubernetes or a remote scheduler: rejected as unnecessary for fifteen local sequential runs.

## Benefits

- Enforces filesystem, command, evaluator-output, and cross-run boundaries.
- Keeps condition policy small and auditable.
- Supports deterministic preparation, order, resumption, and raw result retention.
- Avoids host repository/config mounts and committed secrets.

## Costs and risks

- Docker builds and sidecars add runtime and maintenance cost.
- API endpoint changes require proxy allow-list updates and a new freeze.
- A malicious Docker host administrator remains outside the threat model.
- Some transcript-derived metrics still require human audit.

## Revisit when

- Codex authentication cannot operate through the strict allow-list;
- benchmark execution moves to a managed sandbox with equivalent hard boundaries;
- another agent runner requires a different authenticated endpoint;
- the benchmark expands beyond the local fifteen-run v0.1 experiment.
