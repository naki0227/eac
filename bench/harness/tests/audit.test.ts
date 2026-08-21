import { describe, expect, it } from "vitest";
import { applyHumanAudit, createAuditTemplate } from "../src/audit.js";
import type { BenchmarkResult } from "../src/types.js";

const rawResult: BenchmarkResult = {
  run_id: "c-task-run",
  condition: "C",
  task_id: "task",
  task_prompt: "Build it",
  agent: "codex-cli 0.149.0",
  model: "test-model",
  reasoning_config: "medium",
  cli_version: "0.1.0",
  implementation_commit: "a".repeat(40),
  started_at: "2026-08-21T00:00:00.000Z",
  first_valid_at: "2026-08-21T00:01:00.000Z",
  ended_at: "2026-08-21T00:01:01.000Z",
  status: "completed",
  task_completion: true,
  first_check_pass: false,
  repair_iterations: null,
  hallucinated_api_calls: null,
  invalid_api_values: null,
  docs_search_count: 1,
  direct_docs_calls: 2,
  check_driven_repair_success: null,
  final_errors: 0,
  final_warnings: 0,
  time_to_valid_project_seconds: 60,
  generated_loc: 20,
  cli_calls: 4,
  check_calls: 2,
  final_source_sha256: "b".repeat(64),
  protocol_deviations: [],
  notes: ["raw"],
};

describe("human audit workflow", () => {
  it("creates an unfilled template tied to the immutable raw hash", () => {
    expect(createAuditTemplate(rawResult, "c".repeat(64))).toMatchObject({
      schema_version: 1,
      run_id: "c-task-run",
      raw_result_sha256: "c".repeat(64),
      auditor: null,
      metrics: {
        hallucinated_api_calls: null,
        invalid_api_values: null,
        repair_iterations: null,
        check_driven_repair_success: null,
      },
    });
  });

  it("applies four reviewed metrics without mutating the raw result", () => {
    const audit = {
      ...createAuditTemplate(rawResult, "c".repeat(64)),
      auditor: "reviewer-1",
      audited_at: "2026-08-21T00:02:00.000Z",
      metrics: {
        hallucinated_api_calls: 2,
        invalid_api_values: 1,
        repair_iterations: 1,
        check_driven_repair_success: true,
      },
      evidence_notes: ["Check event 2 follows the first task-complete candidate."],
    };

    const audited = applyHumanAudit(rawResult, "c".repeat(64), audit);

    expect(audited).toMatchObject(audit.metrics);
    expect(rawResult.repair_iterations).toBeNull();
    expect(audited.notes.at(-1)).toContain("reviewer-1");
  });

  it("rejects an audit for different raw bytes", () => {
    const audit = {
      ...createAuditTemplate(rawResult, "c".repeat(64)),
      auditor: "reviewer-1",
      audited_at: "2026-08-21T00:02:00.000Z",
      metrics: {
        hallucinated_api_calls: 0,
        invalid_api_values: 0,
        repair_iterations: 0,
        check_driven_repair_success: false,
      },
      evidence_notes: ["Reviewed transcript."],
    };
    expect(() => applyHumanAudit(rawResult, "d".repeat(64), audit)).toThrow("raw result hash");
  });

  it("rejects incomplete or inferred metric values", () => {
    const audit = {
      ...createAuditTemplate(rawResult, "c".repeat(64)),
      auditor: "reviewer-1",
      audited_at: "2026-08-21T00:02:00.000Z",
      metrics: {
        hallucinated_api_calls: 0,
        invalid_api_values: 0,
        repair_iterations: 0.5,
        check_driven_repair_success: false,
      },
      evidence_notes: ["Reviewed transcript."],
    };
    expect(() => applyHumanAudit(rawResult, "c".repeat(64), audit)).toThrow("repair_iterations");
  });
});
