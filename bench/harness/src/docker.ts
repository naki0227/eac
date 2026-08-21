import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { benchmark, repositoryRoot } from "./config.js";
import { requireSuccess, runCommand, type CommandResult } from "./process.js";
import type { Evaluation } from "./types.js";

const uid = typeof process.getuid === "function" ? process.getuid() : 1000;
const gid = typeof process.getgid === "function" ? process.getgid() : 1000;

export async function buildImages(smoke: boolean): Promise<void> {
  const commit = await requireSuccess("git", ["rev-parse", "HEAD"], repositoryRoot);
  const builds = [
    {
      dockerfile: "bench/harness/docker/Dockerfile.evaluator",
      image: benchmark.evaluatorImage,
      target: undefined,
    },
    {
      dockerfile: "bench/harness/docker/Dockerfile.agent",
      image: smoke ? benchmark.agentSmokeImageA : benchmark.agentImageA,
      target: smoke ? "smoke-a" : "agent-a",
    },
    {
      dockerfile: "bench/harness/docker/Dockerfile.agent",
      image: smoke ? benchmark.agentSmokeImageBC : benchmark.agentImageBC,
      target: smoke ? "smoke-bc" : "agent-bc",
    },
  ] as const;
  for (const build of builds) {
    const args = ["build", "--file", build.dockerfile, "--tag", build.image];
    if (build.target !== undefined) args.push("--target", build.target);
    if (!smoke && build.dockerfile.endsWith("Dockerfile.agent"))
      args.push("--build-arg", `CODEX_VERSION=${benchmark.codexVersion}`);
    args.push("--build-arg", `BENCHMARK_COMMIT=${commit}`);
    args.push(".");
    const result = await runCommand("docker", args, { cwd: repositoryRoot, timeoutMs: 900_000 });
    if (result.exitCode !== 0) throw new Error(`Docker build failed:\n${result.stderr}`);
    const revision = await requireSuccess("docker", [
      "image",
      "inspect",
      "--format",
      '{{ index .Config.Labels "org.opencontainers.image.revision" }}',
      build.image,
    ]);
    if (revision !== commit)
      throw new Error(`Image ${build.image} has stale revision ${revision}.`);
  }
}

export async function verifyCodexImage(): Promise<void> {
  const result = await runCommand("docker", [
    "run",
    "--rm",
    "--network=none",
    "--entrypoint",
    "codex",
    benchmark.agentImageA,
    "--version",
  ]);
  if (result.exitCode !== 0 || !result.stdout.includes(benchmark.codexVersion))
    throw new Error(`Codex image version mismatch: ${result.stdout}${result.stderr}`);
}

export async function createInternalNetwork(name: string): Promise<void> {
  const result = await runCommand("docker", ["network", "create", "--internal", name]);
  if (result.exitCode !== 0) throw new Error(`Cannot create Docker network: ${result.stderr}`);
}

export async function removeNetwork(name: string): Promise<void> {
  await runCommand("docker", ["network", "rm", name]);
}

export async function removeContainer(name: string): Promise<void> {
  await runCommand("docker", ["rm", "--force", name]);
}

const lockedContainerArgs = (): string[] => [
  "--read-only",
  "--cap-drop=ALL",
  "--security-opt=no-new-privileges",
  "--pids-limit=128",
  "--memory=768m",
];

export async function startCapabilityService(
  name: string,
  condition: "B" | "C",
  network: string,
  workspace: string,
): Promise<void> {
  const args = [
    "run",
    "--detach",
    "--name",
    name,
    "--network",
    network,
    "--network-alias",
    "eac-service",
    ...lockedContainerArgs(),
    "--tmpfs",
    "/app/packages/core/.evaluation:rw,uid=1000,gid=1000,mode=0700",
    "--mount",
    `type=bind,src=${workspace},dst=/workspace,readonly`,
    "--env",
    `EAC_CONDITION=${condition}`,
    "--env",
    "EAC_WORKSPACE=/workspace",
    benchmark.evaluatorImage,
  ];
  const result = await runCommand("docker", args);
  if (result.exitCode !== 0) throw new Error(`Cannot start capability service: ${result.stderr}`);
  for (let attempt = 0; attempt < 30; attempt++) {
    const health = await runCommand("docker", [
      "exec",
      name,
      "node",
      "-e",
      'fetch("http://127.0.0.1:4781/health").then(r=>{if(!r.ok)process.exit(1)})',
    ]);
    if (health.exitCode === 0) return;
    await delay(200);
  }
  throw new Error(`Capability service ${name} did not become healthy.`);
}

export async function startEgressProxy(name: string, network: string): Promise<void> {
  const result = await runCommand("docker", [
    "run",
    "--detach",
    "--name",
    name,
    "--network",
    network,
    "--network-alias",
    "eac-proxy",
    ...lockedContainerArgs(),
    "--env",
    `EAC_ALLOWED_HOSTS=${benchmark.proxyAllowedHosts.join(",")}`,
    benchmark.evaluatorImage,
    "node",
    "bench/harness/dist/src/egress-proxy.js",
  ]);
  if (result.exitCode !== 0) throw new Error(`Cannot start egress proxy: ${result.stderr}`);
  const connected = await runCommand("docker", ["network", "connect", "bridge", name]);
  if (connected.exitCode !== 0) throw new Error(`Cannot connect egress proxy: ${connected.stderr}`);
  for (let attempt = 0; attempt < 30; attempt++) {
    const health = await runCommand("docker", [
      "exec",
      name,
      "node",
      "-e",
      'const n=require("node:net").connect(3128,"127.0.0.1",()=>{n.end();process.exit(0)});n.on("error",()=>process.exit(1))',
    ]);
    if (health.exitCode === 0) return;
    await delay(200);
  }
  throw new Error(`Egress proxy ${name} did not become healthy.`);
}

export async function containerLogs(name: string): Promise<string> {
  const result = await runCommand("docker", ["logs", name]);
  return `${result.stdout}${result.stderr}`;
}

export async function runLockedContainer(
  options: Readonly<{
    image: string;
    network: string;
    workspace: string;
    materials?: string;
    args: readonly string[];
    env?: readonly string[];
    authFile?: string;
    timeoutMs?: number;
    name?: string;
  }>,
): Promise<CommandResult> {
  const args = [
    "run",
    "--rm",
    "--network",
    options.network,
    ...lockedContainerArgs(),
    "--user",
    `${uid}:${gid}`,
    "--tmpfs",
    `/tmp:rw,uid=${uid},gid=${gid},mode=0700`,
    "--mount",
    `type=bind,src=${options.workspace},dst=/workspace`,
  ];
  if (options.name !== undefined) args.splice(2, 0, "--name", options.name);
  if (options.materials !== undefined)
    args.push("--mount", `type=bind,src=${options.materials},dst=/materials,readonly`);
  if (options.authFile !== undefined)
    args.push("--mount", `type=bind,src=${options.authFile},dst=/run/eac-auth/auth.json,readonly`);
  for (const environment of options.env ?? []) args.push("--env", environment);
  args.push(options.image, ...options.args);
  return runCommand("docker", args, {
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
  });
}

export async function evaluateInContainer(workspace: string): Promise<Evaluation> {
  await access(resolve(workspace, "eac.config.mjs"));
  const result = await runCommand("docker", [
    "run",
    "--rm",
    "--network=none",
    ...lockedContainerArgs(),
    "--tmpfs",
    "/app/packages/core/.evaluation:rw,uid=1000,gid=1000,mode=0700",
    "--mount",
    `type=bind,src=${workspace},dst=/workspace,readonly`,
    benchmark.evaluatorImage,
    "node",
    "bench/harness/dist/src/evaluator-cli.js",
    "/workspace/eac.config.mjs",
  ]);
  const line = result.stdout.trim().split("\n").at(-1);
  if (line === undefined) throw new Error(`Evaluator produced no result: ${result.stderr}`);
  const parsed = JSON.parse(line) as Evaluation;
  return parsed;
}

export async function imageContains(path: string, image: string): Promise<boolean> {
  const result = await runCommand("docker", [
    "run",
    "--rm",
    "--network=none",
    image,
    "test",
    "-e",
    path,
  ]);
  return result.exitCode === 0;
}

export async function readContainerFile(image: string, path: string): Promise<string> {
  const result = await runCommand("docker", ["run", "--rm", "--network=none", image, "cat", path]);
  if (result.exitCode !== 0) throw new Error(result.stderr);
  return result.stdout;
}
