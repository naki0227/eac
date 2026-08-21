import { access, cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { CodexDockerAgentRunner } from "./agent.js";
import { resolveCodexAuthentication } from "./auth.js";
import { benchmark, generatedRoot, materialDiscoveryMarker, repositoryRoot } from "./config.js";
import { buildImages } from "./docker.js";
import { writeJson } from "./fs.js";
import { currentCommit } from "./freeze.js";
import { parseCodexFinalResponse } from "./preflight.js";
import { buildMaterialDiscoveryPrompt } from "./prompt.js";
import { requireSuccess } from "./process.js";
import { sha256 } from "./result.js";

type Discovery = Readonly<{ apiName: string; declarationPath: string }>;

export function parseCompletedCommandEvidence(output: string): string {
  const evidence: string[] = [];
  for (const line of output.split("\n")) {
    try {
      const value: unknown = JSON.parse(line);
      if (typeof value !== "object" || value === null) continue;
      const event = value as { type?: unknown; item?: unknown };
      if (event.type !== "item.completed" || typeof event.item !== "object" || !event.item)
        continue;
      const item = event.item as {
        type?: unknown;
        command?: unknown;
        aggregated_output?: unknown;
      };
      if (item.type !== "command_execution" || typeof item.command !== "string") continue;
      evidence.push(item.command);
      if (typeof item.aggregated_output === "string") evidence.push(item.aggregated_output);
    } catch {
      // Only structured completed command events count as evidence.
    }
  }
  return evidence.join("\n");
}

export function parseDiscoveryResponse(response: string | null): Discovery | null {
  if (response === null) return null;
  const match =
    /^MATERIAL_DISCOVERY_OK\nAPI: ([A-Za-z_$][A-Za-z0-9_$]*)\nDECLARATION: (\/materials\/public-api\/[^\n]+\.d\.ts)$/.exec(
      response,
    );
  if (match?.[1] === undefined || match[2] === undefined) return null;
  return { apiName: match[1], declarationPath: match[2] };
}

export async function runMaterialDiscoveryPreflight(
  model: string | null,
  reasoningConfig: string | null,
): Promise<void> {
  if (model === null || reasoningConfig === null)
    throw new Error("Material discovery preflight requires explicit --model and --reasoning.");
  const status = await requireSuccess(
    "git",
    ["status", "--porcelain", "--untracked-files=all"],
    repositoryRoot,
  );
  if (status.length > 0) throw new Error("Material discovery preflight requires a clean tree.");
  const authentication = await resolveCodexAuthentication();
  if (authentication.kind !== "chatgpt")
    throw new Error("Material discovery preflight requires file-based ChatGPT authentication.");
  const implementationCommit = await currentCommit();
  await buildImages(false);
  const root = await mkdtemp(resolve(tmpdir(), "eac-material-discovery-"));
  const workspace = resolve(root, "workspace");
  const materials = resolve(root, "materials");
  await mkdir(workspace);
  await mkdir(materials);
  await cp(resolve(generatedRoot, "README.md"), resolve(materials, "README.md"));
  await cp(resolve(generatedRoot, "public-api"), resolve(materials, "public-api"), {
    recursive: true,
  });
  await writeFile(resolve(materials, "task.txt"), buildMaterialDiscoveryPrompt());
  try {
    const output = await new CodexDockerAgentRunner().run({
      runId: "material-discovery-preflight",
      condition: "A",
      task: { id: "material-discovery-preflight", prompt: "Host-only integration probe." },
      workspace,
      materials,
      model,
      reasoningConfig,
      timeoutMs: 180_000,
    });
    if (output.timedOut || output.exitCode !== 0)
      throw new Error(`Material discovery preflight failed: ${output.stderr}`);
    if (output.stderr.includes("EAC_PROXY_DENY"))
      throw new Error("Material discovery preflight attempted a non-allow-listed host.");
    const response = parseCodexFinalResponse(output.stdout);
    const discovery = parseDiscoveryResponse(response);
    if (discovery === null)
      throw new Error(`Unexpected material discovery response: ${JSON.stringify(response)}`);
    const declarationRelative = discovery.declarationPath.slice("/materials/".length);
    const declaration = resolve(materials, declarationRelative);
    if (!declaration.startsWith(`${materials}/`))
      throw new Error("Material discovery declaration path escapes materials.");
    await access(declaration);
    const declarationSource = await readFile(declaration, "utf8");
    if (!new RegExp(`\\b${discovery.apiName}\\b`).test(declarationSource))
      throw new Error(`Material discovery returned undeclared API ${discovery.apiName}.`);
    const commandEvidence = parseCompletedCommandEvidence(output.stdout);
    if (
      !commandEvidence.includes("/materials/README.md") ||
      !commandEvidence.includes("EaC — Experience as Code") ||
      !commandEvidence.includes(discovery.declarationPath) ||
      !commandEvidence.includes(discovery.apiName)
    )
      throw new Error("Material discovery transcript lacks README or declaration read evidence.");
    const workspaceFiles = await readdir(workspace);
    if (workspaceFiles.length > 0)
      throw new Error("Material discovery preflight modified the empty workspace.");
    await writeJson(materialDiscoveryMarker, {
      passed: true,
      implementationCommit,
      checkedAt: new Date().toISOString(),
      agent: `codex-cli ${benchmark.codexVersion}`,
      authentication: "chatgpt",
      model,
      reasoningConfig,
      apiName: discovery.apiName,
      declarationPath: discovery.declarationPath,
      readmeRead: true,
      declarationRead: true,
      responseSha256: sha256(response ?? ""),
      workspaceFiles,
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
