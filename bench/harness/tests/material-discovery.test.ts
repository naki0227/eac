import { describe, expect, it } from "vitest";
import {
  parseCompletedCommandEvidence,
  parseDiscoveryResponse,
} from "../src/material-discovery.js";

describe("real-agent material discovery evidence", () => {
  it("extracts only completed command evidence", () => {
    const output = [
      '{"type":"item.started","item":{"type":"command_execution","command":"ignored"}}',
      '{"type":"item.completed","item":{"type":"command_execution","command":"sed /materials/README.md","aggregated_output":"# EaC"}}',
    ].join("\n");
    expect(parseCompletedCommandEvidence(output)).toBe("sed /materials/README.md\n# EaC");
  });

  it("accepts only the exact discovery response shape", () => {
    expect(
      parseDiscoveryResponse(
        "MATERIAL_DISCOVERY_OK\nAPI: experience\nDECLARATION: /materials/public-api/@eac/core/index.d.ts",
      ),
    ).toEqual({
      apiName: "experience",
      declarationPath: "/materials/public-api/@eac/core/index.d.ts",
    });
    expect(parseDiscoveryResponse("API: experience")).toBeNull();
  });
});
