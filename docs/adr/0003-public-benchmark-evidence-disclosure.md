# ADR 0003: Publish audited benchmark evidence without raw transcripts

## Background

The r3 benchmark produced immutable raw results, agent transcripts, operational logs, final sources,
hash-bound human audits, and audited results. Public claims need inspectable evidence, while raw agent
logs may contain local paths, platform metadata, prompt fragments, or authentication-adjacent data.

## Problem

Publishing only aggregates weakens reproducibility. Publishing `.bench-private` wholesale creates an
unnecessary disclosure risk and makes future redaction difficult to reason about.

## Options

1. Publish aggregate results only.
2. Publish the complete private evidence directory.
3. Publish audited records, audit bindings, hashes, run order, methodology, and final sources while
   retaining raw transcripts and operational logs privately.

## Decision

Adopt option 3. Public evidence lives under `bench/results/r3/`; invalidated experiment history lives
under `bench/history/`. Raw transcripts, stdout/stderr, proxy logs, auth material, and the private
working directory remain unpublished.

## Reasons

- Audited results and final sources let readers inspect outcomes rather than trusting an aggregate.
- Raw-result SHA-256 bindings make later disclosure independently matchable to today's audits.
- Byte-identical source artifacts let readers verify each `final_source_sha256`.
- Withholding operational logs minimizes accidental secret and environment disclosure.

## Benefits

- Stronger reproducibility and scientific transparency than aggregate-only publication.
- Clear privacy boundary and a straightforward future redacted-transcript release.
- Invalidated runs remain visible as methodology history without presenting invalid measurements.

## Drawbacks

- Third parties cannot yet independently repeat transcript-level audit judgments.
- Public hashes prove identity after disclosure, not the semantic correctness of a private record.
- The repository carries 15 result, audit, and source artifacts.

## Revisit conditions

Revisit after a dedicated transcript-redaction review, or when independent replication requires more
evidence than the published artifacts and hash bindings provide.
