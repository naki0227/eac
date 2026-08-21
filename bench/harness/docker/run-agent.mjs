#!/usr/bin/env node
import { chmod, copyFile, mkdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import console from "node:console";
import process from "node:process";

const prompt = await readFile("/materials/task.txt", "utf8");
await mkdir("/tmp/agent-home/.codex", { recursive: true });
try {
  await copyFile("/run/eac-auth/auth.json", "/tmp/agent-home/.codex/auth.json");
  await chmod("/tmp/agent-home/.codex/auth.json", 0o600);
} catch (cause) {
  if (cause?.code !== "ENOENT") throw cause;
}
const args = [
  "exec",
  "--ephemeral",
  "--ignore-user-config",
  "--ignore-rules",
  "--strict-config",
  "--json",
  "--approve-for-me",
  "--skip-git-repo-check",
  "-C",
  "/workspace",
];
if (process.env.EAC_AGENT_MODEL) args.push("--model", process.env.EAC_AGENT_MODEL);
if (process.env.EAC_REASONING_CONFIG)
  args.push("-c", `model_reasoning_effort=${JSON.stringify(process.env.EAC_REASONING_CONFIG)}`);
args.push(prompt);

const child = spawn("codex", args, { stdio: "inherit", env: process.env });
child.on("error", (cause) => {
  console.error(cause);
  process.exitCode = 1;
});
child.on("close", (code) => {
  process.exitCode = code ?? 1;
});
