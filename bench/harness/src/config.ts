import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export const repositoryRoot = resolve(
  here,
  dirname(here).endsWith("/dist") ? "../../../.." : "../../..",
);
export const harnessRoot = resolve(repositoryRoot, "bench/harness");
export const generatedRoot = resolve(repositoryRoot, "bench/generated");
export const privateRoot = resolve(repositoryRoot, ".bench-private");
export const resultsRoot = resolve(privateRoot, "results");
export const artifactsRoot = resolve(privateRoot, "artifacts");
export const runsRoot = resolve(privateRoot, "runs");
export const auditsRoot = resolve(privateRoot, "audits");
export const auditedResultsRoot = resolve(privateRoot, "audited-results");
export const smokeMarker = resolve(privateRoot, "smoke.json");
export const authPreflightMarker = resolve(privateRoot, "auth-preflight.json");
export const materialDiscoveryMarker = resolve(privateRoot, "material-discovery.json");

export const benchmark = Object.freeze({
  baseCommit: "ac440457ea8611da47593b560c6baf8a785a2019",
  freezeTag: "benchmark-v0.1-main-r3",
  seed: "eac-v0.1-main-benchmark-2026-08-21",
  cliVersion: "0.1.0",
  codexVersion: "0.149.0",
  agentImageA: "eac-benchmark-agent-a:0.1.0",
  agentImageBC: "eac-benchmark-agent-bc:0.1.0",
  agentSmokeImageA: "eac-benchmark-agent-a:smoke",
  agentSmokeImageBC: "eac-benchmark-agent-bc:smoke",
  evaluatorImage: "eac-benchmark-evaluator:0.1.0",
  proxyAllowedHosts: [
    "api.openai.com",
    "auth.openai.com",
    "chatgpt.com",
    "ab.chatgpt.com",
    "sdmntpreastus2.oaiusercontent.com",
    "sdmntprsouthcentralus.oaiusercontent.com",
    "sdmntprwestus3.oaiusercontent.com",
  ],
});

export const benchmarkAffectingPaths = Object.freeze([
  "README.md",
  "bench/README.md",
  "bench/metrics.md",
  "bench/tasks.json",
  "bench/generated",
  "bench/harness",
  "packages/cli/src/content.ts",
  "packages/cli/src/docs.ts",
  "packages/checker/src",
  "packages/core/src",
  "packages/ir/src",
  "packages/units/src",
]);
