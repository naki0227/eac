import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { resolve } from "node:path";
import { benchmark, repositoryRoot } from "./config.js";
import { categorizeArgs, commandIsAllowed } from "./conditions.js";
import { evaluateProject } from "./evaluation.js";
import { runCommand } from "./process.js";
import type { Condition } from "./types.js";

type RequestBody = Readonly<{ command?: unknown; args?: unknown }>;
type CommandResponse = Readonly<{ exitCode: number; stdout: string; stderr: string }>;

const configuredCondition = process.env.EAC_CONDITION as Condition | undefined;
const workspace = process.env.EAC_WORKSPACE ?? "/workspace";
const port = Number.parseInt(process.env.EAC_SERVICE_PORT ?? "4781", 10);
if (configuredCondition !== "B" && configuredCondition !== "C")
  throw new Error("EAC_CONDITION must be B or C.");
const condition: "B" | "C" = configuredCondition;

async function body(request: IncomingMessage): Promise<RequestBody> {
  let content = "";
  for await (const chunk of request) {
    content += String(chunk);
    if (content.length > 65_536) throw new Error("Request body is too large.");
  }
  const parsed: unknown = JSON.parse(content);
  if (typeof parsed !== "object" || parsed === null) throw new TypeError("Invalid request body.");
  return {
    command: "command" in parsed ? parsed.command : undefined,
    args: "args" in parsed ? parsed.args : undefined,
  };
}

async function execute(command: string, args: readonly string[]): Promise<CommandResponse> {
  if (!commandIsAllowed(condition, command))
    return {
      exitCode: 127,
      stdout: "",
      stderr: `eac: ${command} is unavailable in Condition ${condition}.\n`,
    };
  if (command === "check") {
    const evaluation = await evaluateProject(resolve(workspace, "eac.config.mjs"));
    return {
      exitCode: evaluation.exitCode,
      stdout: evaluation.stdout,
      stderr: evaluation.stderr,
    };
  }
  const result = await runCommand(
    "node",
    [resolve(repositoryRoot, "packages/cli/dist/bin.js"), command, ...args],
    { cwd: repositoryRoot, timeoutMs: 30_000 },
  );
  return { exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr };
}

function respond(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(value));
}

async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
  if (request.method === "GET" && request.url === "/health")
    return respond(response, 200, { ok: true });
  if (request.method !== "POST" || request.url !== "/command")
    return respond(response, 404, { error: "not found" });
  try {
    const parsed = await body(request);
    if (typeof parsed.command !== "string" || !Array.isArray(parsed.args))
      return respond(response, 400, { error: "invalid command request" });
    const args = parsed.args.filter((value): value is string => typeof value === "string");
    if (args.length !== parsed.args.length)
      return respond(response, 400, { error: "arguments must be strings" });
    const result = await execute(parsed.command, args);
    console.log(
      `EAC_CLI_EVENT ${JSON.stringify({
        timestamp: new Date().toISOString(),
        command: parsed.command,
        argsCategory: categorizeArgs(parsed.command, args),
        exitCode: result.exitCode,
      })}`,
    );
    return respond(response, 200, result);
  } catch (cause) {
    return respond(response, 500, {
      error: cause instanceof Error ? cause.message : "internal capability service error",
    });
  }
}

const server = createServer((request, response) => void handle(request, response));

server.listen(port, "0.0.0.0", () => {
  console.log(
    `EaC capability service ${benchmark.cliVersion} listening for Condition ${condition}.`,
  );
});
