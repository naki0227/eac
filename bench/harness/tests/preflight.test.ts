import { describe, expect, it } from "vitest";
import { parseCodexFinalResponse } from "../src/preflight.js";

describe("Codex transport preflight", () => {
  it("extracts the final agent message from Codex JSONL", () => {
    const output = [
      '{"type":"thread.started","thread_id":"test"}',
      '{"type":"item.completed","item":{"type":"agent_message","text":"BENCH_AUTH_OK"}}',
      '{"type":"turn.completed"}',
    ].join("\n");
    expect(parseCodexFinalResponse(output)).toBe("BENCH_AUTH_OK");
  });

  it("ignores non-agent messages and malformed lines", () => {
    const output = [
      "not-json",
      '{"type":"item.completed","item":{"type":"command_execution","text":"BENCH_AUTH_OK"}}',
    ].join("\n");
    expect(parseCodexFinalResponse(output)).toBeNull();
  });
});
