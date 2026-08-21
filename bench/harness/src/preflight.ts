import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { resolveCodexAuthentication } from "./auth.js";
import { authPreflightMarker, benchmark, repositoryRoot } from "./config.js";
import {
  buildImages,
  containerLogs,
  createInternalNetwork,
  removeContainer,
  removeNetwork,
  runLockedContainer,
  startEgressProxy,
} from "./docker.js";
import { writeJson } from "./fs.js";
import { currentCommit } from "./freeze.js";
import { requireSuccess } from "./process.js";
import { sha256 } from "./result.js";

const expectedResponse = "BENCH_AUTH_OK";

export function parseCodexFinalResponse(output: string): string | null {
  let response: string | null = null;
  for (const line of output.split("\n")) {
    try {
      const value: unknown = JSON.parse(line);
      if (typeof value !== "object" || value === null) continue;
      const event = value as { type?: unknown; item?: unknown };
      if (event.type !== "item.completed" || typeof event.item !== "object" || !event.item)
        continue;
      const item = event.item as { type?: unknown; text?: unknown };
      if (item.type === "agent_message" && typeof item.text === "string") response = item.text;
    } catch {
      // JSONL may contain non-event process output; only structured agent messages are evidence.
    }
  }
  return response;
}

export async function runAuthTransportPreflight(): Promise<void> {
  const status = await requireSuccess(
    "git",
    ["status", "--porcelain", "--untracked-files=all"],
    repositoryRoot,
  );
  if (status.length > 0) throw new Error("Auth preflight requires a clean final working tree.");
  const implementationCommit = await currentCommit();
  const authentication = await resolveCodexAuthentication();
  if (authentication.kind !== "chatgpt")
    throw new Error("Auth transport preflight requires file-based ChatGPT authentication.");
  await buildImages(false);
  const root = await mkdtemp(resolve(tmpdir(), "eac-auth-preflight-"));
  const workspace = resolve(root, "workspace");
  const materials = resolve(root, "materials");
  await mkdir(workspace);
  await mkdir(materials);
  await writeFile(resolve(materials, "task.txt"), "Reply exactly: BENCH_AUTH_OK\n");
  const suffix = randomUUID().slice(0, 8);
  const network = `eac-auth-preflight-${suffix}`;
  const proxy = `eac-auth-proxy-${suffix}`;
  const agent = `eac-auth-agent-${suffix}`;
  await createInternalNetwork(network);
  try {
    await startEgressProxy(proxy, network);
    const result = await runLockedContainer({
      image: benchmark.agentImageA,
      network,
      workspace,
      materials,
      args: [],
      env: [
        "HTTPS_PROXY=http://eac-proxy:3128",
        "HTTP_PROXY=http://eac-proxy:3128",
        "NO_PROXY=localhost,127.0.0.1",
      ],
      authFile: authentication.authFile,
      timeoutMs: 180_000,
      name: agent,
    });
    const proxyLogs = await containerLogs(proxy);
    if (result.timedOut || result.exitCode !== 0)
      throw new Error(`Codex auth transport preflight failed: ${result.stderr}`);
    if (proxyLogs.includes("EAC_PROXY_DENY"))
      throw new Error("Codex auth transport preflight attempted a non-allow-listed host.");
    const response = parseCodexFinalResponse(result.stdout);
    if (response !== expectedResponse)
      throw new Error(`Unexpected Codex preflight response: ${JSON.stringify(response)}`);
    const exposedMaterials = await readdir(materials);
    if (exposedMaterials.length !== 1 || exposedMaterials[0] !== "task.txt")
      throw new Error("Auth preflight exposed unexpected material files.");
    await writeJson(authPreflightMarker, {
      passed: true,
      implementationCommit,
      checkedAt: new Date().toISOString(),
      agent: `codex-cli ${benchmark.codexVersion}`,
      authentication: "chatgpt",
      responseSha256: sha256(response),
      exposedMaterials,
    });
  } finally {
    await removeContainer(agent);
    await removeContainer(proxy);
    await removeNetwork(network);
    await rm(root, { recursive: true, force: true });
  }
}
