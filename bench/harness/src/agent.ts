import { randomUUID } from "node:crypto";
import { benchmark } from "./config.js";
import {
  containerLogs,
  createInternalNetwork,
  removeContainer,
  removeNetwork,
  runLockedContainer,
  startCapabilityService,
  startEgressProxy,
} from "./docker.js";
import { parseCliEvents } from "./result.js";
import type { AgentRunner, AgentRunInput, AgentRunOutput } from "./types.js";

const safeName = (prefix: string, runId: string): string =>
  `${prefix}-${runId
    .toLowerCase()
    .replaceAll(/[^a-z0-9_.-]/g, "-")
    .slice(0, 36)}-${randomUUID().slice(0, 8)}`;

export class CodexDockerAgentRunner implements AgentRunner {
  async run(input: AgentRunInput): Promise<AgentRunOutput> {
    if (!process.env.OPENAI_API_KEY)
      throw new Error(
        "OPENAI_API_KEY is required; host Codex config mounts are intentionally unsupported.",
      );
    const network = safeName("eac-net", input.runId);
    const service = safeName("eac-service", input.runId);
    const proxy = safeName("eac-proxy", input.runId);
    const agent = safeName("eac-agent", input.runId);
    let cliLogs = "";
    let proxyLogs = "";
    await createInternalNetwork(network);
    try {
      if (input.condition !== "A")
        await startCapabilityService(service, input.condition, network, input.workspace);
      await startEgressProxy(proxy, network);
      const environment = [
        "OPENAI_API_KEY",
        "HTTPS_PROXY=http://eac-proxy:3128",
        "HTTP_PROXY=http://eac-proxy:3128",
        "NO_PROXY=eac-service,localhost,127.0.0.1",
        ...(input.model === null ? [] : [`EAC_AGENT_MODEL=${input.model}`]),
        ...(input.reasoningConfig === null
          ? []
          : [`EAC_REASONING_CONFIG=${input.reasoningConfig}`]),
      ];
      const startedAt = new Date().toISOString();
      const result = await runLockedContainer({
        image: input.condition === "A" ? benchmark.agentImageA : benchmark.agentImageBC,
        network,
        workspace: input.workspace,
        materials: input.materials,
        args: [],
        env: environment,
        timeoutMs: input.timeoutMs,
        name: agent,
      });
      if (input.condition !== "A") cliLogs = await containerLogs(service);
      proxyLogs = await containerLogs(proxy);
      return {
        exitCode: result.timedOut ? null : result.exitCode,
        timedOut: result.timedOut,
        startedAt,
        endedAt: new Date().toISOString(),
        stdout: result.stdout,
        stderr: `${result.stderr}${proxyLogs.includes("EAC_PROXY_DENY") ? `\n${proxyLogs}` : ""}`,
        cliEvents: parseCliEvents(cliLogs),
      };
    } finally {
      await removeContainer(agent);
      if (input.condition !== "A") await removeContainer(service);
      await removeContainer(proxy);
      await removeNetwork(network);
    }
  }
}
