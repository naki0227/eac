import { cp, mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { benchmark, harnessRoot, repositoryRoot, smokeMarker } from "./config.js";
import {
  buildImages,
  containerLogs,
  createInternalNetwork,
  evaluateInContainer,
  removeContainer,
  removeNetwork,
  runLockedContainer,
  startCapabilityService,
  startEgressProxy,
  verifyCodexImage,
} from "./docker.js";
import { assertExpectedCommit, currentCommit } from "./freeze.js";
import { writeJson } from "./fs.js";
import { verifyPrepared } from "./prepare.js";

type SmokeCheck = Readonly<{ name: string; passed: boolean; detail: string }>;

const requirePassed = (check: SmokeCheck): SmokeCheck => {
  if (!check.passed) throw new Error(`Smoke check failed: ${check.name}\n${check.detail}`);
  return check;
};

async function commandCheck(
  name: string,
  image: string,
  network: string,
  workspace: string,
  command: string,
  expectedExit: number,
  includes?: string,
  authFile?: string,
): Promise<SmokeCheck> {
  const result = await runLockedContainer({
    image,
    network,
    workspace,
    args: ["sh", "-lc", command],
    ...(authFile === undefined ? {} : { authFile }),
  });
  const combined = `${result.stdout}${result.stderr}`;
  return requirePassed({
    name,
    passed:
      result.exitCode === expectedExit && (includes === undefined || combined.includes(includes)),
    detail: `exit=${result.exitCode}\n${combined}`,
  });
}

export async function runSmoke(): Promise<readonly SmokeCheck[]> {
  await verifyPrepared();
  await buildImages(true);
  await buildImages(false);
  await verifyCodexImage();
  const root = await mkdtemp(resolve(tmpdir(), "eac-harness-smoke-"));
  const workspaceA = resolve(root, "run-a");
  const workspaceB = resolve(root, "run-b");
  const workspaceC = resolve(root, "run-c");
  const previousWorkspace = resolve(root, "previous-run-not-mounted");
  const fakeAuthFile = resolve(root, "auth.json");
  await Promise.all(
    [workspaceA, workspaceB, workspaceC, previousWorkspace].map((path) =>
      mkdir(path, { recursive: true }),
    ),
  );
  await writeFile(resolve(previousWorkspace, "previous-secret"), "must remain isolated");
  await writeFile(fakeAuthFile, '{"test":"not-a-credential"}');
  await cp(
    resolve(harnessRoot, "fixtures/broken-experience/eac.config.mjs"),
    resolve(workspaceC, "eac.config.mjs"),
  );
  const suffix = randomUUID().slice(0, 8);
  const network = `eac-smoke-${suffix}`;
  const serviceB = `eac-smoke-b-${suffix}`;
  const serviceC = `eac-smoke-c-${suffix}`;
  const proxy = `eac-smoke-proxy-${suffix}`;
  const checks: SmokeCheck[] = [];
  await createInternalNetwork(network);
  try {
    checks.push(
      await commandCheck(
        "Condition A has no CLI or hidden implementation path",
        benchmark.agentSmokeImageA,
        network,
        workspaceA,
        "! command -v eac && ! test -e /app && ! test -e /repo && ! test -e /usr/local/lib/eac",
        0,
      ),
    );
    checks.push({
      name: "pinned Codex agent image builds",
      passed: true,
      detail: benchmark.codexVersion,
    });
    checks.push(
      await commandCheck(
        "only the selected auth file is mounted read-only",
        benchmark.agentSmokeImageA,
        network,
        workspaceA,
        "test -r /run/eac-auth/auth.json && ! test -e /workspace/auth.json && ! sh -c 'echo changed > /run/eac-auth/auth.json'",
        0,
        undefined,
        fakeAuthFile,
      ),
    );
    checks.push(
      await commandCheck(
        "Condition A cannot execute check",
        benchmark.agentSmokeImageA,
        network,
        workspaceA,
        "eac check",
        127,
      ),
    );
    checks.push(
      await commandCheck(
        "child cannot see bench results",
        benchmark.agentSmokeImageA,
        network,
        workspaceA,
        "test ! -e /workspace/bench/results && test ! -e /bench/results",
        0,
      ),
    );
    checks.push(
      await commandCheck(
        "run cannot see previous workspace",
        benchmark.agentSmokeImageA,
        network,
        workspaceB,
        "test ! -e /workspace/previous-secret && test ! -e /runs",
        0,
      ),
    );
    await startCapabilityService(serviceB, "B", network, workspaceB);
    for (const [name, command, includes] of [
      ["Condition B help", "eac help", "EaC — Experience as Code"],
      ["Condition B guide", "eac guide", "HOW TO BUILD WITH EAC"],
      ["Condition B direct docs", "eac docs moveTo", "moveTo"],
      ["Condition B docs search", 'eac docs search "move along"', "Relevant APIs"],
    ] as const)
      checks.push(
        await commandCheck(
          name,
          benchmark.agentSmokeImageBC,
          network,
          workspaceB,
          command,
          0,
          includes,
        ),
      );
    checks.push(
      await commandCheck(
        "Condition B cannot execute check",
        benchmark.agentSmokeImageBC,
        network,
        workspaceB,
        "eac check",
        127,
        "unavailable in Condition B",
      ),
    );
    const bLogs = await containerLogs(serviceB);
    checks.push(
      requirePassed({
        name: "CLI invocation telemetry is external",
        passed: bLogs.includes("EAC_CLI_EVENT") && !(await readdir(workspaceB)).includes("cli.log"),
        detail: bLogs,
      }),
    );
    await removeContainer(serviceB);
    await cp(
      resolve(repositoryRoot, "examples/basic-motion/eac.config.mjs"),
      resolve(workspaceB, "eac.config.mjs"),
    );
    const beforeBValidation = await readdir(workspaceB);
    const bEvaluation = await evaluateInContainer(workspaceB);
    const afterBValidation = await readdir(workspaceB);
    checks.push(
      requirePassed({
        name: "A/B evaluator output is not returned to child workspace",
        passed:
          bEvaluation.exitCode === 0 &&
          JSON.stringify(beforeBValidation.sort()) === JSON.stringify(afterBValidation.sort()),
        detail: bEvaluation.stdout,
      }),
    );
    await startCapabilityService(serviceC, "C", network, workspaceC);
    checks.push(
      await commandCheck(
        "Condition C retains docs",
        benchmark.agentSmokeImageBC,
        network,
        workspaceC,
        "eac docs cycloid",
        0,
        "cycloid",
      ),
    );
    checks.push(
      await commandCheck(
        "B/C image has no implementation source",
        benchmark.agentSmokeImageBC,
        network,
        workspaceC,
        "test ! -e /app && test ! -e /repo && test ! -e /packages",
        0,
      ),
    );
    checks.push(
      await commandCheck(
        "Condition C can execute check",
        benchmark.agentSmokeImageBC,
        network,
        workspaceC,
        "eac check",
        1,
        "eac::motion::conflicting-writers",
      ),
    );
    await startEgressProxy(proxy, network);
    checks.push(
      await commandCheck(
        "direct external network is unavailable",
        benchmark.agentSmokeImageBC,
        network,
        workspaceC,
        `node -e 'const n=require("node:net").connect(443,"github.com");const t=setTimeout(()=>{n.destroy();process.exit(0)},500);n.on("connect",()=>process.exit(1));n.on("error",()=>{clearTimeout(t);process.exit(0)})'`,
        0,
      ),
    );
    checks.push(
      await commandCheck(
        "egress proxy rejects GitHub",
        benchmark.agentSmokeImageBC,
        network,
        workspaceC,
        `node -e 'const n=require("node:net").connect(3128,"eac-proxy",()=>n.write("CONNECT github.com:443 HTTP/1.1\\r\\nHost: github.com\\r\\n\\r\\n"));n.on("data",d=>process.exit(d.toString().includes("403")?0:1));n.on("error",()=>process.exit(1))'`,
        0,
      ),
    );
    await removeContainer(serviceC);
    await removeContainer(proxy);
    const beforeEvaluation = await readdir(workspaceC);
    const evaluation = await evaluateInContainer(workspaceC);
    const afterEvaluation = await readdir(workspaceC);
    checks.push(
      requirePassed({
        name: "evaluator sees frozen broken fixture diagnostics",
        passed:
          evaluation.stdout.includes("eac::motion::conflicting-writers") &&
          evaluation.stdout.includes("eac::timeline::invalid-range") &&
          evaluation.stdout.includes("eac::layout::aabb-overlap"),
        detail: evaluation.stdout,
      }),
    );
    checks.push(
      requirePassed({
        name: "evaluator output is not written to child workspace",
        passed: JSON.stringify(beforeEvaluation.sort()) === JSON.stringify(afterEvaluation.sort()),
        detail: `before=${beforeEvaluation.join(",")} after=${afterEvaluation.join(",")}`,
      }),
    );
    const commit = await currentCommit();
    assertExpectedCommit(commit, commit);
    checks.push({ name: "frozen SHA check", passed: true, detail: commit });
    await writeJson(smokeMarker, {
      passed: true,
      implementationCommit: commit,
      checkedAt: new Date().toISOString(),
      checks: checks.map(({ name }) => name),
    });
    return checks;
  } finally {
    await removeContainer(serviceB);
    await removeContainer(serviceC);
    await removeContainer(proxy);
    await removeNetwork(network);
    await rm(root, { recursive: true, force: true });
  }
}
