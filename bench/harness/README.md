# Isolated benchmark harness

This harness prevents an EaC benchmark child from learning through files, commands, diagnostics, or
artifacts that its condition does not permit. The 15-run main experiment is not part of harness setup.

## Isolation architecture

Each run uses a fresh, read-only-root Docker container. It receives two task-data bind mounts:

- its own writable `/workspace`;
- generated README/type materials at read-only `/materials`.

When ChatGPT authentication is selected, the host additionally mounts only the selected
`auth.json` file read-only. The entrypoint copies it to the container's private tmpfs so Codex can
refresh credentials without modifying the host cache. The rest of `~/.codex` is never mounted.

The repository, `bench/results/`, host configuration, other run directories, and Docker socket are
never mounted. Linux capabilities are dropped, privilege escalation is disabled, and memory/process
limits are applied. Outputs move to host-only `.bench-private/` only after the agent exits.

Condition capabilities are:

| Condition | Public declarations | help/guide/docs | check diagnostics    |
| --------- | ------------------- | --------------- | -------------------- |
| A         | yes                 | unavailable     | unavailable          |
| B         | yes                 | available       | technically rejected |
| C         | yes                 | available       | available            |

Condition A uses an image with no `eac` executable. B/C contain only a small network proxy executable;
the CLI and checker implementation live in a separate capability-service container. That service
enforces the condition again, so directly calling its HTTP endpoint does not bypass B's check denial.

For A/B, the capability service is detached/destroyed before authoritative validation. A separate
networkless evaluator copies the artifact into its private package scope, runs the frozen
`eac check --ci`, and returns output only to the host orchestrator. C can check through its service,
and still receives the same final evaluator pass.

## Network boundary

Real Codex containers attach only to an internal Docker network. A dual-homed CONNECT proxy allows
only the pinned OpenAI service hosts (`api.openai.com`, `auth.openai.com`, `chatgpt.com`,
`ab.chatgpt.com`, and the three observed `sdmntpr*.oaiusercontent.com` regional hosts) on port
443; direct internet routes and GitHub are unavailable. ChatGPT authentication is the default:
the harness uses `EAC_CODEX_AUTH_FILE` when set, otherwise `~/.codex/auth.json`. `OPENAI_API_KEY`
remains an optional fallback when no file-based login exists. If Codex changes required service
hosts, update and re-freeze the allow-list before any run.

Local Docker administrators can inspect containers and secrets while a run exists. They must not do
so during the experiment. This is a local isolation harness, not protection against a malicious host.

## Prepare frozen materials

```bash
pnpm bench:prepare
git diff --exit-code -- bench/generated
```

Preparation snapshots the allowed README, public `.d.ts` graph, CLI documentation data, API-name
audit list, and broken fixture hashes in `bench/generated/manifest.json`. Generation is deterministic;
any declaration, documentation, or fixture change requires a new benchmark freeze.

The task wording remains unchanged inside a common harness prompt. That prompt tells every condition
to inspect `/materials/README.md` and `/materials/public-api/`, but does not inline their contents.
Only B/C receive a neutral hint that an `eac` command may exist; A receives no CLI suggestion.

The supplied broken fixture is
`bench/harness/fixtures/broken-experience/eac.config.mjs`. Its test freezes these diagnostics:

- `eac::motion::conflicting-writers`;
- `eac::timeline::invalid-range`;
- `eac::layout::aabb-overlap`.

## Smoke test

```bash
pnpm bench:smoke
```

This builds dummy and real agent images plus the evaluator image without invoking a real agent. It
tests command availability, hidden-path absence, result and cross-run isolation, external telemetry,
GitHub egress denial, evaluator separation, fixture diagnostics, Codex version, and image revision.
The host-only smoke marker is valid only for the commit it tested.

## Real authentication transport preflight

After the final harness commit is clean and before creating the freeze tag, run exactly once:

```bash
pnpm bench:preflight-auth
```

This starts a separate Condition-A agent container with an empty workspace and a `/materials`
directory containing only `task.txt`. The prompt is exactly `Reply exactly: BENCH_AUTH_OK`. It does
not mount or copy the EaC README, declarations, CLI, fixtures, tasks, repository, or results. Success
requires an exact structured Codex response, no denied proxy destination, and a marker bound to the
current commit. `run` and `run-all` reject a missing or stale preflight marker.

## Real-agent material discovery preflight

After the final harness commit is clean, verify the exact benchmark model can discover both allowed
material sources without creating a project:

```bash
pnpm bench:preflight-materials --model <exact-model-id> --reasoning <level>
```

This uses a separate Condition-A container and a non-benchmark probe. Success requires completed
command evidence that the agent read `/materials/README.md` and a real declaration below
`/materials/public-api/`, an API name actually present in that declaration, an unchanged empty
workspace, no denied egress, and a host-only marker bound to the commit/model/reasoning tuple. The
probe transcript is not added to benchmark results.

## Freeze workflow

After implementation, fixtures, local validation, and CI are final:

```bash
pnpm bench:smoke
pnpm bench:preflight-auth
pnpm bench:preflight-materials --model <exact-model-id> --reasoning <level>
git tag -a benchmark-v0.1-main-r2 <final-sha> -m "Freeze EaC v0.1 main benchmark r2"
```

`run` and `run-all` refuse a missing tag, a checkout that differs from the tag, a dirty tree, stale
prepared hashes, a smoke marker from another commit, or a missing/stale real-auth preflight marker.
The material-discovery marker must also match the run's model and reasoning configuration. The
evaluator and agent images carry the same commit in their OCI revision label.

Benchmark-affecting inputs include README/API declarations, help/guide/docs, checker behavior,
tasks, metrics, fixtures, generated materials, condition packaging, and the Docker/harness policy.
Changing any of them after tagging invalidates the experiment and requires a new tag/version.

## Human metric audit

Raw benchmark records deliberately leave these fields unaudited:

- `hallucinated_api_calls`;
- `invalid_api_values`;
- `repair_iterations`;
- `check_driven_repair_success`.

Their definitions remain frozen in `bench/metrics.md`; only their observation procedure is manual.
For each run, create a hash-bound audit template:

```bash
pnpm bench:audit <run-id>
```

The command preserves an existing template and prints the evidence paths. Review `agent.jsonl`,
`cli-events.json`, `undefined-api-candidates.json`, the final source, and evaluation. Then fill the
four metric values, `auditor`, canonical `audited_at`, and at least one concrete `evidence_notes`
entry. Apply it with:

```bash
pnpm bench:audit <run-id> --apply
```

Apply verifies the immutable raw-result SHA-256 and writes a separate
`.bench-private/audited-results/<run-id>.json`; it never edits raw results. Count every actual call to
an undefined EaC API, and separately count invalid names or shapes passed to real APIs. For
`repair_iterations`, identify the first task-complete candidate from transcript and CLI-event
evidence, then count candidate edits followed by checks after it. Do not derive it from
`check_calls - 1`; exclude incomplete preflight checks. Set `check_driven_repair_success` true only
when a recorded checker diagnostic caused a later candidate to remove that finding.

After all runs have matching audited results:

```bash
pnpm bench:analyze --audited
```

Audited analysis refuses partial coverage and keeps raw records authoritative evidence.

## Run one task

```bash
pnpm bench:run --condition A --task basic-timed-motion \
  --model <exact-model-id> --reasoning <level>
```

Run `codex login` once before the benchmark. If Codex stores credentials in the OS keychain, set
`cli_auth_credentials_store = "file"`, log in again, and confirm `~/.codex/auth.json` exists. A
separate file can be selected with `EAC_CODEX_AUTH_FILE=/path/to/auth.json`.

One run creates a new container/network/workspace, preserves transcript/source/evaluation under
`.bench-private/artifacts/<run-id>/`, writes one JSON record under `.bench-private/results/`, and then
destroys disposable state. Records follow `bench/harness/result.schema.json`. The exact task text comes
from `bench/tasks.json`. Do not mix an ad-hoc single run into the main experiment: `run-all` accepts
existing results only when they form an exact prefix of its persisted seeded order.

## Run or resume all 15 tasks

```bash
pnpm bench:run-all --model <exact-model-id> --reasoning <level>
```

The seeded order is persisted once at `.bench-private/run-order.json`. Completed condition/task pairs
are skipped on restart; unfinished runs get new isolated state. Never copy private results into
`bench/results/` until all runs finish and the user explicitly approves publication. An infrastructure
failure stops the suite; an agent timeout/crash is recorded and does not contaminate later runs.

## Analyze

```bash
pnpm bench:analyze
```

Analysis emits deterministic descriptive totals by condition and A→B/B→C data structures. It makes
no significance or causal claims. Raw JSON remains authoritative. The four manually observed
metrics remain `null` in raw records and are populated only in separately audited results.

## Known limitations

- ChatGPT login requires a file-based Codex auth cache; an OS-keychain-only login cannot be mounted
  into Docker.
- Hallucinated/invalid API classification needs transcript review; candidate extraction is best effort.
- Semantic satisfaction beyond checker validity is represented by agent completion plus evaluator
  success and may require later blinded audit.
- Docker image builds are intentionally heavier than worktree-only isolation.

Do not start the main benchmark if the freeze checks, smoke checks, or network boundary cannot be
enforced on the execution host.
