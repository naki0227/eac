import { createHash } from "node:crypto";
import { cp, mkdir, readFile, stat } from "node:fs/promises";
import { basename, dirname, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as prettier from "prettier";
import { benchmark, generatedRoot, harnessRoot, repositoryRoot } from "./config.js";
import { replaceDirectory, writeJson, writeText } from "./fs.js";

const declarationSources = [
  "packages/core/dist/index.d.ts",
  "packages/core/dist/builders.d.ts",
  "packages/core/dist/object-builder.d.ts",
  "packages/ir/dist/index.d.ts",
  "packages/ir/dist/types.d.ts",
  "packages/ir/dist/evaluate.d.ts",
  "packages/units/dist/index.d.ts",
] as const;

type Manifest = Readonly<{
  schemaVersion: 1;
  cliVersion: string;
  files: Readonly<Record<string, string>>;
}>;

const digest = (content: string | Buffer): string =>
  createHash("sha256").update(content).digest("hex");

async function ensureBuilt(): Promise<void> {
  for (const source of declarationSources)
    try {
      await stat(resolve(repositoryRoot, source));
    } catch {
      throw new Error(`Missing ${source}. Run pnpm build before bench:prepare.`);
    }
}

async function copyDeclaration(source: string): Promise<string> {
  const packageName = source.split("/")[1];
  if (packageName === undefined) throw new Error(`Invalid declaration path: ${source}`);
  const destination = resolve(generatedRoot, "public-api", `@eac/${packageName}`, basename(source));
  await mkdir(dirname(destination), { recursive: true });
  await cp(resolve(repositoryRoot, source), destination);
  return destination;
}

async function formatGenerated(path: string): Promise<void> {
  const source = await readFile(path, "utf8");
  await writeText(
    path,
    await prettier.format(source, {
      filepath: path,
      semi: true,
      singleQuote: false,
      trailingComma: "all",
      printWidth: 100,
    }),
  );
}

async function manifestFor(paths: readonly string[]): Promise<Manifest> {
  const entries: (readonly [string, string])[] = await Promise.all(
    [...paths]
      .sort()
      .map(async (path): Promise<readonly [string, string]> => [
        relative(repositoryRoot, path),
        digest(await readFile(path)),
      ]),
  );
  const fixture = resolve(harnessRoot, "fixtures/broken-experience/eac.config.mjs");
  entries.push([relative(repositoryRoot, fixture), digest(await readFile(fixture))]);
  return { schemaVersion: 1, cliVersion: benchmark.cliVersion, files: Object.fromEntries(entries) };
}

export async function prepareFixtures(): Promise<Manifest> {
  await ensureBuilt();
  const contentModule = (await import(
    pathToFileURL(resolve(repositoryRoot, "packages/cli/dist/content.js")).href
  )) as Readonly<{ help: string; guide: string }>;
  const docsModule = (await import(
    pathToFileURL(resolve(repositoryRoot, "packages/cli/dist/docs.js")).href
  )) as Readonly<{ apiDocs: readonly unknown[] }>;
  await replaceDirectory(generatedRoot);
  const generated: string[] = [];
  for (const source of declarationSources) generated.push(await copyDeclaration(source));
  const readme = resolve(generatedRoot, "README.md");
  await cp(resolve(repositoryRoot, "README.md"), readme);
  generated.push(readme);
  const cli = resolve(generatedRoot, "cli.json");
  await writeJson(cli, {
    help: contentModule.help,
    guide: contentModule.guide,
    apiDocs: docsModule.apiDocs,
  });
  generated.push(cli);
  const publicNames = resolve(generatedRoot, "public-api-names.json");
  await writeJson(publicNames, {
    functions: ["experience", "px", "sec", "ms", "deg", "rad", "depth", "opacity"],
    members: [
      "scene",
      "build",
      "rect",
      "circle",
      "text",
      "path",
      "moveTo",
      "rotateTo",
      "fadeTo",
      "depthTo",
      "bringForward",
      "dependsOn",
      "unsupported",
    ],
  });
  generated.push(publicNames);
  for (const path of generated) await formatGenerated(path);
  const manifest = await manifestFor(generated);
  await writeJson(resolve(generatedRoot, "manifest.json"), manifest);
  await formatGenerated(resolve(generatedRoot, "manifest.json"));
  return manifest;
}

export async function verifyPrepared(): Promise<Manifest> {
  const manifestPath = resolve(generatedRoot, "manifest.json");
  const value: unknown = JSON.parse(await readFile(manifestPath, "utf8"));
  if (typeof value !== "object" || value === null)
    throw new Error("Prepared fixture manifest must be an object.");
  const parsed = value as Partial<Manifest>;
  if (parsed.schemaVersion !== 1 || parsed.cliVersion !== benchmark.cliVersion)
    throw new Error("Prepared fixture manifest version does not match the harness.");
  if (typeof parsed.files !== "object")
    throw new Error("Prepared fixture manifest files are missing.");
  for (const [path, expected] of Object.entries(parsed.files)) {
    const absolute = resolve(repositoryRoot, path);
    if (!absolute.startsWith(repositoryRoot))
      throw new Error(`Fixture path escapes repository: ${path}`);
    if (digest(await readFile(absolute)) !== expected)
      throw new Error(`Prepared fixture hash mismatch: ${path}`);
  }
  return parsed as Manifest;
}

export async function writeTaskMaterial(path: string, prompt: string): Promise<void> {
  await writeText(path, `${prompt.trim()}\n`);
}
