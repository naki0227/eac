import { analyzeResults } from "./analyze.js";
import { auditRun } from "./audit.js";
import { runAuthTransportPreflight } from "./preflight.js";
import { prepareFixtures } from "./prepare.js";
import { runAll, runOne } from "./orchestrator.js";
import { runSmoke } from "./smoke.js";
import type { Condition } from "./types.js";

const args = process.argv.slice(2);
const command = args[0] ?? "help";

const valueAfter = (flag: string): string | undefined => {
  const index = args.indexOf(flag);
  return index < 0 ? undefined : args[index + 1];
};

const options = () => ({
  model: valueAfter("--model") ?? null,
  reasoningConfig: valueAfter("--reasoning") ?? null,
  timeoutMs: Number.parseInt(valueAfter("--timeout-seconds") ?? "900", 10) * 1000,
});

async function main(): Promise<void> {
  if (command === "prepare") {
    const manifest = await prepareFixtures();
    console.log(`Prepared ${Object.keys(manifest.files).length} frozen fixture files.`);
    return;
  }
  if (command === "smoke") {
    const checks = await runSmoke();
    for (const check of checks) console.log(`✓ ${check.name}`);
    console.log(`${checks.length} smoke checks passed.`);
    return;
  }
  if (command === "preflight-auth") {
    await runAuthTransportPreflight();
    console.log("✓ Codex ChatGPT auth transport preflight passed.");
    return;
  }
  if (command === "audit") {
    const runId = args[1];
    if (runId === undefined) throw new Error("audit requires <run-id>.");
    console.log(JSON.stringify(await auditRun(runId, args.includes("--apply")), null, 2));
    return;
  }
  if (command === "run") {
    const condition = valueAfter("--condition") as Condition | undefined;
    const task = valueAfter("--task");
    if ((condition !== "A" && condition !== "B" && condition !== "C") || task === undefined)
      throw new Error("run requires --condition A|B|C and --task <task-id>.");
    console.log(JSON.stringify(await runOne(condition, task, options()), null, 2));
    return;
  }
  if (command === "run-all") {
    const results = await runAll(options());
    console.log(`Completed or resumed ${results.length} isolated runs.`);
    return;
  }
  if (command === "analyze") {
    process.stdout.write(await analyzeResults(args.includes("--audited")));
    return;
  }
  console.log(`EaC benchmark harness

Commands:
  prepare
  smoke
  preflight-auth
  audit <run-id> [--apply]
  run --condition A|B|C --task <task-id> [--model <id>] [--reasoning <level>]
  run-all [--model <id>] [--reasoning <level>]
  analyze [--audited]`);
}

try {
  await main();
} catch (cause) {
  console.error(cause instanceof Error ? cause.message : String(cause));
  process.exitCode = 1;
}
