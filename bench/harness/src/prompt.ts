import type { Condition } from "./types.js";

function materialInstructions(condition: Condition): string {
  const cliHint =
    condition === "A"
      ? ""
      : "\nAn `eac` command may be available in this condition.\nUse only commands that actually exist.\n";
  return `Your writable workspace is:
  /workspace

Benchmark materials available to you are under:
  /materials

You should inspect the materials available to your condition before implementing the task.

At minimum, the condition may provide:
  /materials/README.md
  /materials/public-api/

Only use capabilities and materials actually available in this environment.
Do not assume unavailable commands or APIs.
${cliHint}`;
}

export function buildBenchmarkAgentPrompt(task: string, condition: Condition): string {
  return `You are completing an EaC benchmark task in an isolated workspace.

Task:
${task.trim()}

${materialInstructions(condition)}
Create the requested EaC project in:
  /workspace/eac.config.mjs

When you believe the task is complete, stop.
`;
}

export function buildMaterialDiscoveryPrompt(): string {
  return `You are validating material discovery for an EaC benchmark harness.

Task:
Read /materials/README.md and the contents of at least one .d.ts file under
/materials/public-api/. Report one EaC public API name that is declared there.
Do not create or modify any files.

${materialInstructions("A")}
Your final response must use exactly these three lines:
MATERIAL_DISCOVERY_OK
API: <one public API name>
DECLARATION: <the .d.ts path you read>
`;
}
