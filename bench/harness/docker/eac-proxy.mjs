#!/usr/bin/env node
import process from "node:process";

const [command = "help", ...args] = process.argv.slice(2);
const endpoint = process.env.EAC_SERVICE_URL ?? "http://eac-service:4781/command";

try {
  const response = await globalThis.fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ command, args }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? `service returned ${response.status}`);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exitCode = Number.isInteger(result.exitCode) ? result.exitCode : 1;
} catch (cause) {
  process.stderr.write(
    `eac capability service failure: ${cause instanceof Error ? cause.message : String(cause)}\n`,
  );
  process.exitCode = 1;
}
