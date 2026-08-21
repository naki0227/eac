import { describe, expect, it } from "vitest";
import { parseCodexFinalResponse, parseDeniedProxyHosts } from "../src/preflight.js";

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

describe("proxy diagnostics", () => {
  it("returns unique sorted denied host names without other log data", () => {
    const logs = [
      "EaC egress proxy allows: chatgpt.com",
      'EAC_PROXY_DENY {"timestamp":"ignored","host":"z.openai.com"}',
      'EAC_PROXY_DENY {"timestamp":"ignored","host":"a.openai.com"}',
      'EAC_PROXY_DENY {"timestamp":"ignored","host":"z.openai.com"}',
    ].join("\n");
    expect(parseDeniedProxyHosts(logs)).toEqual(["a.openai.com", "z.openai.com"]);
  });
});
